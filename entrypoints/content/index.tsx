import '@/assets/global.css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  SavedWordPopover,
  SelectionPopover,
  type EditableFields,
  type PopoverMode,
  type SelectionRect,
} from './components/SelectionPopover'
import { InPageUI } from '@/components/InPageUI'
import { highlightService, type HoverEvent } from '@/lib/highlightService'
import {
  deleteRecordById,
  getRecordById,
  getRecordByWord,
  importVocabularyPayload,
  markRecord,
  saveFromAiResponse,
  saveRecord,
  updateRecordFields,
} from '@/lib/vocabApi'
import { normalizeWordOrPhrase, type VocabRecord, type VocabTombstone } from '@/lib/vocabTypes'
import type { VocabResponse } from '@/lib/aiSchema'
import type { MarkAction } from '@/lib/familiarity'
import type { RuntimeMessage } from '@/lib/messaging'
import { NO_SELECTION_CONTAINER } from '@/const'
import { checkIsDisabled, copyHandler } from './utils'
import { useAIStream } from './useAIStream'
import { THEME_STORAGE_KEY, resolveStoredEffectiveTheme } from '@/lib/theme'

async function applyThemeClass(...targets: Array<HTMLElement | null>) {
  const effective = await resolveStoredEffectiveTheme()
  for (const target of targets) {
    if (!target) continue
    target.classList.toggle('dark', effective === 'dark')
    target.classList.toggle('light', effective === 'light')
  }
}

// ─────────────────────────────────────────────────────────────────────────────

type PopoverState = {
  rect: SelectionRect
  mode: PopoverMode
  selectionText?: string
  sourceContext?: string
  recordId?: number
}

type HoverState = {
  rect: SelectionRect
  recordId: number
}

// Mirrors HoverCard closeDelay behavior for virtual anchors; without a real
// trigger/content pair, this grace window lets the pointer cross the gap.
const HOVER_CLOSE_DELAY_MS = 300
const HOVER_SAFE_AREA_PADDING = 12

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let setPopoverStateFn: ((s: PopoverState | null) => void) | null = null
    let closeSavedHoverFn: (() => void) | null = null
    let portalContainer: HTMLElement | null = null

    function InPageUIRoot() {
      const [open, setOpen] = useState(false)
      const [popoverState, setPopoverState] = useState<PopoverState | null>(null)
      const [hoverState, setHoverState] = useState<HoverState | null>(null)
      const [savedRecord, setSavedRecord] = useState<VocabRecord | null>(null)
      const [hoverRecord, setHoverRecord] = useState<VocabRecord | null>(null)
      const [saving, setSaving] = useState(false)
      const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
      const hoverContentLockedRef = useRef(false)
      const hoverContentRectRef = useRef<SelectionRect | null>(null)
      const pointerRef = useRef({ x: 0, y: 0 })
      const aiStream = useAIStream()

      function clearHoverCloseTimer() {
        if (!hoverCloseTimerRef.current) return
        clearTimeout(hoverCloseTimerRef.current)
        hoverCloseTimerRef.current = null
      }

      function closeHoverPopover() {
        clearHoverCloseTimer()
        hoverContentLockedRef.current = false
        hoverContentRectRef.current = null
        setHoverState(null)
      }

      function scheduleHoverClose() {
        clearHoverCloseTimer()
        hoverCloseTimerRef.current = setTimeout(() => {
          hoverCloseTimerRef.current = null
          if (hoverContentLockedRef.current) return
          setHoverState((current) => {
            if (!current) return null
            if (isPointInHoverSafeArea(pointerRef.current, current.rect, hoverContentRectRef.current)) {
              scheduleHoverClose()
              return current
            }
            return null
          })
        }, HOVER_CLOSE_DELAY_MS)
      }

      function openHoverPopover(hit: HoverEvent) {
        clearHoverCloseTimer()
        hoverContentLockedRef.current = false
        hoverContentRectRef.current = null
        setPopoverState(null)
        setHoverState({ rect: hit.rect, recordId: hit.recordId })
      }

      // Expose setter for DOM listeners
      useEffect(() => {
        setPopoverStateFn = setPopoverState
        closeSavedHoverFn = closeHoverPopover
        return () => {
          setPopoverStateFn = null
          closeSavedHoverFn = null
        }
      }, [])

      useEffect(() => {
        let cancelled = false
        let debounceTimer: ReturnType<typeof setTimeout> | undefined

        const refreshHighlights = async () => {
          await highlightService.highlightVocabulary()
        }

        void refreshHighlights()

        const observer = highlightService.observeChanges(() => {
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            void refreshHighlights()
          }, 500)
        })

        highlightService.setHoverListener((hit) => {
          if (cancelled) return
          if (hit) {
            openHoverPopover(hit)
          } else {
            scheduleHoverClose()
          }
        })

        const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
          if (areaName !== 'local') return
          if (changes.hightlightStyle) void refreshHighlights()
        }
        const handleRuntimeMessage = (message: RuntimeMessage) => {
          if (message.type === 'vocabChanged') void refreshHighlights()
        }
        chrome.storage.onChanged.addListener(handleStorageChange)
        chrome.runtime.onMessage.addListener(handleRuntimeMessage)

        return () => {
          cancelled = true
          if (debounceTimer) clearTimeout(debounceTimer)
          observer.disconnect()
          clearHoverCloseTimer()
          highlightService.setHoverListener(null)
          chrome.storage.onChanged.removeListener(handleStorageChange)
          chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
        }
      }, [])

      // Load saved record when the selected popover targets one.
      useEffect(() => {
        let cancelled = false
        if (popoverState?.recordId != null) {
          getRecordById(popoverState.recordId).then((r) => {
            if (cancelled || !r) return
            setSavedRecord(r)
          })
        } else {
          setSavedRecord(null)
        }
        return () => { cancelled = true }
      }, [popoverState?.recordId])

      // Load saved record for hover preview separately so hover never mutates
      // the selection popover's state machine.
      useEffect(() => {
        let cancelled = false
        if (hoverState?.recordId != null) {
          setHoverRecord(null)
          getRecordById(hoverState.recordId).then((r) => {
            if (cancelled || !r) return
            setHoverRecord(r)
          })
        } else {
          setHoverRecord(null)
        }
        return () => { cancelled = true }
      }, [hoverState?.recordId])

      useEffect(() => {
        const handler = (msg: RuntimeMessage) => {
          if (msg.type === 'openVocabList') setOpen(true)
        }
        chrome.runtime.onMessage.addListener(handler)
        return () => chrome.runtime.onMessage.removeListener(handler)
      }, [])

      useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
          pointerRef.current = { x: event.clientX, y: event.clientY }
        }
        document.addEventListener('pointermove', handlePointerMove, { passive: true })
        return () => document.removeEventListener('pointermove', handlePointerMove)
      }, [])

      const cardRecord: Partial<VocabResponse> | VocabRecord | undefined = useMemo(() => {
        if (popoverState?.recordId != null && savedRecord) return savedRecord
        return aiStream.partial
      }, [popoverState?.recordId, savedRecord, aiStream.partial])

      function dismiss() {
        setPopoverState(null)
        closeHoverPopover()
      }

      function dismissSelection() { setPopoverState(null) }

      function dismissSavedHover() { closeHoverPopover() }

      function handleQuery() {
        if (!popoverState?.selectionText) return
        setPopoverState((s) => (s ? { ...s, mode: 'card' } : s))
        aiStream.start(popoverState.selectionText, popoverState.sourceContext)
      }

      function handleCopy() {
        if (!popoverState?.selectionText) return
        copyHandler(popoverState.selectionText)
        dismiss()
      }

      function handleSpeak() {
        const text = savedRecord?.term || popoverState?.selectionText || cardRecord?.term
        if (!text) return
        speakText(text)
      }

      function handleHoverSpeak() {
        if (!hoverRecord?.term) return
        speakText(hoverRecord.term)
      }

      function speakText(text: string) {
        try {
          const u = new SpeechSynthesisUtterance(text)
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(u)
        } catch {}
      }

      async function handleSave() {
        if (!popoverState) return
        const final = aiStream.final
        if (!final) return
        setSaving(true)
        try {
          const { record } = await saveFromAiResponse(final, {
            sourceUrl: window.location.href,
            sourceContext: popoverState.sourceContext || '',
          })
          setSavedRecord(record)
          setPopoverState((s) => (s ? { ...s, recordId: record.id } : s))
          await highlightService.highlightVocabulary()
        } catch (e) {
          console.error('Save failed:', e)
        } finally {
          setSaving(false)
        }
      }

      async function handleMark(action: MarkAction) {
        if (!savedRecord?.id) return
        const next = await markRecord(savedRecord.id, action)
        if (!next) return
        setSavedRecord(next)
        await highlightService.highlightVocabulary()
      }

      async function handleHoverMark(action: MarkAction) {
        if (!hoverRecord?.id) return
        const next = await markRecord(hoverRecord.id, action)
        if (!next) return
        setHoverRecord(next)
        await highlightService.highlightVocabulary()
      }

      async function handleDelete() {
        if (!savedRecord?.id) return
        await deleteRecordById(savedRecord.id)
        dismiss()
        await highlightService.highlightVocabulary()
      }

      async function handleHoverDelete() {
        if (!hoverRecord?.id) return
        await deleteRecordById(hoverRecord.id)
        dismissSavedHover()
        await highlightService.highlightVocabulary()
      }

      function handleEnterEdit() { setPopoverState((s) => (s ? { ...s, mode: 'edit' } : s)) }

      async function handleEditCommit(fields: EditableFields) {
        setSaving(true)
        try {
          if (savedRecord?.id) {
            const updated = await updateRecordFields(savedRecord.id, {
              term: fields.term,
              phonetic: fields.phonetic,
              pos: fields.pos,
              senses: fields.senses.map((s, i) => ({ id: `s${i + 1}`, ...s })),
              mnemonic: fields.mnemonic,
            })
            if (updated) setSavedRecord(updated)
            setPopoverState((s) => (s ? { ...s, mode: 'card' } : s))
            await highlightService.highlightVocabulary()
          } else {
            const { record } = await saveRecord({
              term: fields.term,
              phonetic: fields.phonetic,
              pos: fields.pos,
              senses: fields.senses,
              mnemonic: fields.mnemonic,
              sourceUrl: window.location.href,
              sourceContext: popoverState?.sourceContext || '',
            })
            setSavedRecord(record)
            setPopoverState((s) => (s ? { ...s, mode: 'card', recordId: record.id } : s))
            await highlightService.highlightVocabulary()
          }
        } finally {
          setSaving(false)
        }
      }

      return (
        <>
          <InPageUI open={open} onOpenChange={setOpen} />
          <SelectionPopover
            open={!!popoverState}
            rect={popoverState?.rect ?? null}
            mode={popoverState?.mode ?? 'operation-bar'}
            portalContainer={portalContainer}
            onDismiss={dismissSelection}
            selectionText={popoverState?.selectionText}
            onQuery={handleQuery}
            onCopy={handleCopy}
            record={cardRecord}
            streaming={aiStream.status === 'loading' || aiStream.status === 'streaming'}
            errorMessage={aiStream.status === 'error' ? aiStream.error : null}
            retryInfo={aiStream.retryInfo}
            savedRecord={savedRecord}
            onSave={handleSave}
            onMark={handleMark}
            onEnterEdit={handleEnterEdit}
            onDelete={handleDelete}
            onRetry={aiStream.retry}
            onSpeak={handleSpeak}
            onEditCommit={handleEditCommit}
            onEditCancel={() => setPopoverState((s) => (s ? { ...s, mode: 'card' } : s))}
            saving={saving}
            hasReceivedChunk={aiStream.hasReceivedChunk}
          />
          {hoverState && hoverRecord && (
            <SavedWordPopover
              open
              rect={hoverState.rect}
              portalContainer={portalContainer}
              record={hoverRecord}
              savedRecord={hoverRecord}
              onPointerEnter={() => {
                hoverContentLockedRef.current = true
                clearHoverCloseTimer()
              }}
              onPointerLeave={() => {
                hoverContentLockedRef.current = false
                scheduleHoverClose()
              }}
              onContentRectChange={(rect) => {
                hoverContentRectRef.current = rect
              }}
              onMark={handleHoverMark}
              onEnterEdit={() => {
                setPopoverState({ rect: hoverState.rect, mode: 'edit', recordId: hoverState.recordId })
                setSavedRecord(hoverRecord)
                closeHoverPopover()
              }}
              onDelete={handleHoverDelete}
              onSpeak={handleHoverSpeak}
              onDismiss={dismissSavedHover}
            />
          )}
        </>
      )
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'vocabify-root',
      position: 'inline',
      anchor: 'body',
      onMount: (container, shadow, host) => {
        host.id = 'vocabify-root'
        Object.assign(host.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          zIndex: '2147483647',
          pointerEvents: 'none',
        })
        container.style.pointerEvents = 'auto'

        const syncTheme = () => {
          void applyThemeClass(container, portalContainer)
        }
        syncTheme()
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const onMediaChange = syncTheme
        const onStorage = (event: StorageEvent) => {
          if (event.key === THEME_STORAGE_KEY) {
            syncTheme()
          }
        }
        const onChromeStorage = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
          if (areaName === 'local' && changes[THEME_STORAGE_KEY]) {
            syncTheme()
          }
        }
        mediaQuery.addEventListener('change', onMediaChange)
        window.addEventListener('storage', onStorage)
        chrome.storage.onChanged.addListener(onChromeStorage)

        const reactMount = document.createElement('div')
        reactMount.id = 'vocabify-react-root'
        container.appendChild(reactMount)

        portalContainer = document.createElement('div')
        portalContainer.id = 'vocabify-portal-root'
        portalContainer.style.pointerEvents = 'auto'
        shadow.appendChild(portalContainer)
        syncTheme()

        const root = ReactDOM.createRoot(reactMount)
        root.render(<InPageUIRoot />)
        return { root, mediaQuery, onMediaChange, onStorage, onChromeStorage }
      },
      onRemove: (state) => {
        if (!state) return
        state.mediaQuery.removeEventListener('change', state.onMediaChange)
        window.removeEventListener('storage', state.onStorage)
        chrome.storage.onChanged.removeListener(state.onChromeStorage)
        state.root.unmount()
      },
    })

    ui.mount()
    void migratePageOriginVocabulary()

    // ── DOM listeners ───────────────────────────────────────────────────────
    document.addEventListener('mousedown', function (event) {
      if (isVocabifyUiEvent(event)) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.(`.${NO_SELECTION_CONTAINER}`)) return
      setPopoverStateFn?.(null)
      closeSavedHoverFn?.()
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setPopoverStateFn?.(null)
        closeSavedHoverFn?.()
      }
    })

    document.addEventListener('mouseup', async function (event) {
      if (isVocabifyUiEvent(event)) return
      const target = event.target
      if (checkIsDisabled(target)) return
      if (!(target instanceof HTMLElement)) return
      if (target.closest('.vocabify-highlight')) return
      if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA') return
      if (target.isContentEditable) return

      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const selectedText = selection.toString().trim()
      if (!selectedText) {
        setPopoverStateFn?.(null)
        return
      }

      const range = selection.getRangeAt(0).cloneRange()
      if (range.collapsed) return

      const rect = getSelectionRect(range)
      if (!rect) return
      if (!eventPointIntersectsSelection(event, range)) return

      const savedId = await lookupSavedRecordId(selectedText)
      if (savedId != null) {
        setPopoverStateFn?.({ rect, mode: 'card', recordId: savedId })
        return
      }

      const sourceContext = extractSourceContext(range)
      setPopoverStateFn?.({ rect, mode: 'operation-bar', selectionText: selectedText, sourceContext })
    })

  },
})

// ─── Utilities ────────────────────────────────────────────────────────────────

async function lookupSavedRecordId(rawText: string): Promise<number | null> {
  const key = normalizeWordOrPhrase(rawText)
  if (!key) return null
  const record = await getRecordByWord(key)
  return record?.id ?? null
}

async function migratePageOriginVocabulary() {
  const migrationKey = `vocabify-page-db-migrated:${location.origin}`
  const storage = await chrome.storage.local.get(migrationKey)
  if (storage[migrationKey]) return
  const payload = await readLegacyPageOriginDb()
  if (!payload || (payload.records.length === 0 && payload.tombstones.length === 0)) {
    await chrome.storage.local.set({ [migrationKey]: true })
    return
  }
  await importVocabularyPayload(payload)
  await chrome.storage.local.set({ [migrationKey]: true })
  await highlightService.highlightVocabulary()
}

async function readLegacyPageOriginDb(): Promise<{
  records: Array<Partial<VocabRecord>>
  tombstones: Array<Partial<VocabTombstone>>
} | null> {
  const dbs = indexedDB.databases ? await indexedDB.databases().catch(() => []) : []
  if (!dbs.some((dbInfo) => dbInfo.name === 'VocabifyIndexDB')) return null

  return new Promise((resolve) => {
    const request = indexedDB.open('VocabifyIndexDB')
    request.onerror = () => resolve(null)
    request.onsuccess = () => {
      const legacyDb = request.result
      const records = legacyDb.objectStoreNames.contains('records')
        ? readStore<Partial<VocabRecord>>(legacyDb, 'records')
        : Promise.resolve([])
      const tombstones = legacyDb.objectStoreNames.contains('syncTombstones')
        ? readStore<Partial<VocabTombstone>>(legacyDb, 'syncTombstones')
        : Promise.resolve([])
      Promise.all([records, tombstones])
        .then(([nextRecords, nextTombstones]) => {
          legacyDb.close()
          resolve({ records: nextRecords, tombstones: nextTombstones })
        })
        .catch(() => {
          legacyDb.close()
          resolve(null)
        })
    }
  })
}

function readStore<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).getAll()
    request.onsuccess = () => resolve((request.result || []) as T[])
    request.onerror = () => reject(request.error)
  })
}

function getSelectionRect(range: Range): SelectionRect | null {
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
  const rect = rects[rects.length - 1] || range.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height }
}

function eventPointIntersectsSelection(event: MouseEvent, range: Range): boolean {
  const x = event.clientX
  const y = event.clientY
  if (x === 0 && y === 0) return false

  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
  return rects.some((rect) =>
    x >= rect.left
    && x <= rect.right
    && y >= rect.top
    && y <= rect.bottom,
  )
}

function isPointInHoverSafeArea(
  point: { x: number; y: number },
  anchorRect: SelectionRect,
  contentRect: SelectionRect | null,
): boolean {
  if (!contentRect) return false

  const left = Math.min(anchorRect.left, contentRect.left) - HOVER_SAFE_AREA_PADDING
  const right = Math.max(anchorRect.right, contentRect.right) + HOVER_SAFE_AREA_PADDING
  const top = Math.min(anchorRect.top, contentRect.top) - HOVER_SAFE_AREA_PADDING
  const bottom = Math.max(anchorRect.bottom, contentRect.bottom) + HOVER_SAFE_AREA_PADDING

  return point.x >= left
    && point.x <= right
    && point.y >= top
    && point.y <= bottom
}

function extractSourceContext(range: Range): string {
  let node: Node | null = range.commonAncestorContainer
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode
  const block = node as HTMLElement | null
  if (!block) return range.toString().trim()
  const full = block.textContent || ''
  const sel = range.toString().trim()
  if (!sel) return full.slice(0, 240).trim()
  const idx = full.indexOf(sel)
  if (idx === -1) return full.slice(0, 240).trim()
  const start = Math.max(0, idx - 100)
  const end = Math.min(full.length, idx + sel.length + 100)
  return full.slice(start, end).trim()
}

function isVocabifyUiEvent(event: Event) {
  return event.composedPath().some((node) =>
    node instanceof HTMLElement && node.classList.contains(NO_SELECTION_CONTAINER),
  )
}

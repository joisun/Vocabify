import '@/assets/global.css'
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  SelectionPopover,
  SELECTION_POPOVER_ESTIMATED_HEIGHT,
  type EditableFields,
  type PopoverMode,
  type SelectionRect,
} from './components/SelectionPopover'
import { InPageUI } from '@/components/InPageUI'
import { highlightService, type HoverEvent } from '@/lib/highlightService'
import {
  db,
  deleteRecordById,
  markRecord,
  normalizeWordOrPhrase,
  saveFromAiResponse,
  saveRecord,
  settleAndPersistDecay,
  updateRecordFields,
  type VocabRecord,
} from '@/lib/vocabifyDb'
import type { VocabResponse } from '@/lib/aiSchema'
import { FAMILIARITY_LEVELS, getLevel, MARK_DELTA, type MarkAction } from '@/lib/familiarity'
import { NO_SELECTION_CONTAINER } from '@/const'
import { checkIsDisabled, copyHandler } from './utils'
import { useAIStream } from './useAIStream'

const VOCABIFY_THEME_KEY = 'vocabify-theme'

function resolveTheme(): 'light' | 'dark' {
  try {
    const stored = window.localStorage?.getItem(VOCABIFY_THEME_KEY) as 'light' | 'dark' | 'system' | null
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage may be blocked
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeClass(target: HTMLElement, theme: 'light' | 'dark') {
  target.classList.toggle('dark', theme === 'dark')
  target.classList.toggle('light', theme === 'light')
}

// ─────────────────────────────────────────────────────────────────────────────

type PopoverState = {
  rect: SelectionRect
  placement: 'top' | 'bottom'
  mode: PopoverMode
  source: 'selection' | 'hover'
  // For new-word selection
  selectionText?: string
  sourceContext?: string
  // For saved-word card
  recordId?: number
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    function InPageUIRoot() {
      const [open, setOpen] = useState(false)
      const [popoverState, setPopoverState] = useState<PopoverState | null>(null)
      const [savedRecord, setSavedRecord] = useState<VocabRecord | null>(null)
      const [saving, setSaving] = useState(false)
      const aiStream = useAIStream()

      // Load saved record when popover targets one
      useEffect(() => {
        let cancelled = false
        if (popoverState?.recordId != null) {
          db.records.get(popoverState.recordId).then(async (r) => {
            if (cancelled || !r) return
            const settled = await settleAndPersistDecay(r)
            setSavedRecord(settled)
          })
        } else {
          setSavedRecord(null)
        }
        return () => { cancelled = true }
      }, [popoverState?.recordId])

      // Listen for messages from popup or content script
      useEffect(() => {
        const handler = (msg: any) => {
          if (msg.type === 'openVocabList') {
            setOpen(true)
          }
        }
        chrome.runtime.onMessage.addListener(handler)
        return () => chrome.runtime.onMessage.removeListener(handler)
      }, [])

      // Expose handlers globally for DOM listeners to call
      useEffect(() => {
        ;(window as any).__vocabifyShowOperationBar = (
          text: string,
          rect: SelectionRect,
          placement: 'top' | 'bottom',
          sourceContext: string,
        ) => {
          setPopoverState({ rect, placement, mode: 'operation-bar', source: 'selection', selectionText: text, sourceContext })
        }

        ;(window as any).__vocabifyShowSavedCard = (
          rect: SelectionRect,
          placement: 'top' | 'bottom',
          recordId: number,
          source: 'selection' | 'hover',
        ) => {
          setPopoverState({ rect, placement, mode: 'card', source, recordId })
        }

        ;(window as any).__vocabifyDismissSelectionAction = (force = false) => {
          if (!force) {
            setPopoverState((current) => (current?.source === 'hover' ? current : null))
            return
          }
          setPopoverState(null)
        }

        return () => {
          delete (window as any).__vocabifyShowOperationBar
          delete (window as any).__vocabifyShowSavedCard
          delete (window as any).__vocabifyDismissSelectionAction
        }
      }, [])

      const isLegacyNewWordCard = popoverState?.mode === 'card' && !popoverState.recordId
      const cardRecord: Partial<VocabResponse> | VocabRecord | undefined = useMemo(() => {
        if (popoverState?.recordId != null && savedRecord) return savedRecord
        return aiStream.partial
      }, [popoverState?.recordId, savedRecord, aiStream.partial])

      function dismiss(force = true) {
        ;(window as any).__vocabifyDismissSelectionAction?.(force)
      }

      function handleQuery() {
        if (!popoverState?.selectionText) return
        setPopoverState((s) => (s ? { ...s, mode: 'card' } : s))
        aiStream.start(popoverState.selectionText, popoverState.sourceContext)
      }

      function handleCopy() {
        if (!popoverState?.selectionText) return
        copyHandler(popoverState.selectionText)
        dismiss(true)
      }

      function handleSpeak() {
        const text = savedRecord?.term || cardRecord?.term || popoverState?.selectionText
        if (!text) return
        try {
          const u = new SpeechSynthesisUtterance(text)
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(u)
        } catch {
          // ignore
        }
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
          setPopoverState((s) => (s ? { ...s, recordId: record.id, source: 'selection' } : s))
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
        const level = getLevel(next.score)
        showMarkToast(`${FAMILIARITY_LEVELS[level].label} · ${next.score}`, formatDelta(MARK_DELTA[action]))
        await highlightService.highlightVocabulary()
      }

      async function handleDelete() {
        if (!savedRecord?.id) return
        await deleteRecordById(savedRecord.id)
        dismiss(true)
        await highlightService.highlightVocabulary()
      }

      function handleEnterEdit() {
        setPopoverState((s) => (s ? { ...s, mode: 'edit' } : s))
      }

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
            // Edit-before-save on a streamed new record
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
            setPopoverState((s) => (s ? { ...s, mode: 'card', recordId: record.id, source: 'selection' } : s))
            await highlightService.highlightVocabulary()
          }
        } finally {
          setSaving(false)
        }
      }

      function handleEditCancel() {
        setPopoverState((s) => (s ? { ...s, mode: 'card' } : s))
      }

      return (
        <>
          <InPageUI open={open} onOpenChange={setOpen} />
          {popoverState && (
            <SelectionPopover
              rect={popoverState.rect}
              placement={popoverState.placement}
              mode={popoverState.mode}
              onDismiss={() => dismiss(true)}
              onPointerEnter={() => hoverBridge.cancelDismiss()}
              onPointerLeave={() => hoverBridge.scheduleDismiss()}
              selectionText={popoverState.selectionText}
              onQuery={handleQuery}
              onCopy={handleCopy}
              record={cardRecord}
              streaming={aiStream.status === 'loading' || aiStream.status === 'streaming'}
              errorMessage={aiStream.status === 'error' ? aiStream.error : null}
              savedRecord={savedRecord}
              onSave={handleSave}
              onMark={handleMark}
              onEnterEdit={handleEnterEdit}
              onDelete={handleDelete}
              onRetry={aiStream.retry}
              onSpeak={handleSpeak}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
              saving={saving}
            />
          )}
          {void isLegacyNewWordCard}
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

        applyThemeClass(container, resolveTheme())
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const onMediaChange = () => applyThemeClass(container, resolveTheme())
        const onStorage = (event: StorageEvent) => {
          if (event.key === VOCABIFY_THEME_KEY) applyThemeClass(container, resolveTheme())
        }
        mediaQuery.addEventListener('change', onMediaChange)
        window.addEventListener('storage', onStorage)

        const reactMount = document.createElement('div')
        reactMount.id = 'vocabify-react-root'
        container.appendChild(reactMount)

        const portalContainer = document.createElement('div')
        portalContainer.id = 'vocabify-portal-root'
        portalContainer.style.pointerEvents = 'auto'
        shadow.appendChild(portalContainer)

        const root = ReactDOM.createRoot(reactMount)
        root.render(<InPageUIRoot />)
        return { root, mediaQuery, onMediaChange, onStorage }
      },
      onRemove: (state) => {
        if (!state) return
        state.mediaQuery.removeEventListener('change', state.onMediaChange)
        window.removeEventListener('storage', state.onStorage)
        state.root.unmount()
      },
    })

    ui.mount()

    // ── DOM listeners ───────────────────────────────────────────────────────
    document.addEventListener('mousedown', function (event) {
      const target = event.target as HTMLElement | null
      if (isVocabifyUiEvent(event) || target?.closest?.(`.${NO_SELECTION_CONTAINER}`)) return
      ;(window as any).__vocabifyDismissSelectionAction?.()
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        ;(window as any).__vocabifyDismissSelectionAction?.(true)
      }
    })

    document.addEventListener('mouseup', async function (event) {
      if (isVocabifyUiEvent(event)) return
      const target = event.target
      if (checkIsDisabled(target)) return
      if (!(target instanceof HTMLElement)) return
      if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA') return
      if (target.isContentEditable) return

      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const selectedText = selection.toString().trim()
      if (!selectedText) {
        ;(window as any).__vocabifyDismissSelectionAction?.()
        return
      }

      const range = selection.getRangeAt(0).cloneRange()
      if (range.collapsed) return

      const rect = getUsableSelectionRect(range)
      if (!rect) return

      const placement = getSelectionActionPlacement(rect)
      const savedId = await lookupSavedRecordId(selectedText)
      if (savedId != null) {
        ;(window as any).__vocabifyShowSavedCard?.(rect, placement, savedId, 'selection')
        return
      }

      const sourceContext = extractSourceContext(range)
      ;(window as any).__vocabifyShowOperationBar?.(selectedText, rect, placement, sourceContext)
    })

    // ── Highlight saved vocabulary ──────────────────────────────────────────
    await highlightService.highlightVocabulary()

    let debounceTimer: ReturnType<typeof setTimeout>
    highlightService.observeChanges(() => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        highlightService.highlightVocabulary()
      }, 500)
    })

    // ── Hover bridge ────────────────────────────────────────────────────────
    highlightService.setHoverListener((hit: HoverEvent | null) => {
      if (!hit) {
        hoverBridge.scheduleDismiss()
        return
      }
      hoverBridge.cancelDismiss()
      const placement = getSelectionActionPlacement(hit.rect)
      ;(window as any).__vocabifyShowSavedCard?.(hit.rect, placement, hit.recordId, 'hover')
    })
  },
})

const hoverBridge = createHoverBridge()

function createHoverBridge(delay = 220) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    scheduleDismiss() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        ;(window as any).__vocabifyDismissSelectionAction?.(true)
        timer = null
      }, delay)
    },
    cancelDismiss() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

async function lookupSavedRecordId(rawText: string): Promise<number | null> {
  const key = normalizeWordOrPhrase(rawText)
  if (!key) return null
  const record = await db.records.where('wordOrPhrase').equals(key).first()
  return record?.id ?? null
}

function extractSourceContext(range: Range): string {
  // Walk up to the closest block parent and take its textContent, then trim
  // around the selection to ~120 chars before / after.
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

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return '±0'
}

function showMarkToast(title: string, detail: string) {
  const host = document.createElement('div')
  host.className = NO_SELECTION_CONTAINER
  Object.assign(host.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    padding: '8px 14px',
    borderRadius: '999px',
    backdropFilter: 'blur(20px)',
    background: 'rgba(20, 20, 22, 0.78)',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    transition: 'opacity 200ms ease, transform 200ms ease',
    opacity: '0',
    pointerEvents: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  } as Partial<CSSStyleDeclaration>)
  host.textContent = `${title}  ${detail}`
  document.body.appendChild(host)
  requestAnimationFrame(() => {
    host.style.opacity = '1'
    host.style.transform = 'translate(-50%, -6px)'
  })
  setTimeout(() => {
    host.style.opacity = '0'
    host.style.transform = 'translateX(-50%)'
    setTimeout(() => host.remove(), 220)
  }, 1400)
}

function getUsableSelectionRect(range: Range): SelectionRect | null {
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
  const rect = rects[rects.length - 1] || range.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  return {
    top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left,
    width: rect.width, height: rect.height,
  }
}

function isVocabifyUiEvent(event: Event) {
  return event.composedPath().some((node) =>
    node instanceof HTMLElement && node.classList.contains(NO_SELECTION_CONTAINER),
  )
}

function getSelectionActionPlacement(rect: SelectionRect): 'top' | 'bottom' {
  const viewport = getViewportBounds()
  const gap = 8
  const availableTop = rect.top - viewport.top
  const availableBottom = viewport.bottom - rect.bottom

  if (availableTop >= SELECTION_POPOVER_ESTIMATED_HEIGHT + gap) return 'top'
  if (availableBottom >= SELECTION_POPOVER_ESTIMATED_HEIGHT + gap) return 'bottom'
  return availableBottom >= availableTop ? 'bottom' : 'top'
}

function getViewportBounds() {
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const height = viewport?.height ?? window.innerHeight
  return { top, bottom: top + height }
}

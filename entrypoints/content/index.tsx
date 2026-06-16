import '@/assets/global.css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  SelectionPopover,
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
import { THEME_STORAGE_KEY, resolveEffectiveTheme } from '@/lib/theme'

function applyThemeClass(target: HTMLElement) {
  const effective = resolveEffectiveTheme()
  target.classList.toggle('dark', effective === 'dark')
  target.classList.toggle('light', effective === 'light')
}

// ─────────────────────────────────────────────────────────────────────────────

type PopoverState = {
  rect: SelectionRect
  mode: PopoverMode
  selectionText?: string
  sourceContext?: string
  recordId?: number
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let setPopoverStateFn: ((s: PopoverState | null) => void) | null = null
    let portalContainer: HTMLElement | null = null

    function InPageUIRoot() {
      const [open, setOpen] = useState(false)
      const [popoverState, setPopoverState] = useState<PopoverState | null>(null)
      const [savedRecord, setSavedRecord] = useState<VocabRecord | null>(null)
      const [saving, setSaving] = useState(false)
      const aiStream = useAIStream()

      // Expose setter for DOM listeners
      useEffect(() => {
        setPopoverStateFn = setPopoverState
        return () => { setPopoverStateFn = null }
      }, [])

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

      useEffect(() => {
        const handler = (msg: any) => {
          if (msg.type === 'openVocabList') setOpen(true)
        }
        chrome.runtime.onMessage.addListener(handler)
        return () => chrome.runtime.onMessage.removeListener(handler)
      }, [])

      const cardRecord: Partial<VocabResponse> | VocabRecord | undefined = useMemo(() => {
        if (popoverState?.recordId != null && savedRecord) return savedRecord
        return aiStream.partial
      }, [popoverState?.recordId, savedRecord, aiStream.partial])

      function dismiss() { setPopoverState(null) }

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
        const text = savedRecord?.term || cardRecord?.term || popoverState?.selectionText
        if (!text) return
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
        const level = getLevel(next.score)
        showMarkToast(`${FAMILIARITY_LEVELS[level].label} · ${next.score}`, formatDelta(MARK_DELTA[action]))
        await highlightService.highlightVocabulary()
      }

      async function handleDelete() {
        if (!savedRecord?.id) return
        await deleteRecordById(savedRecord.id)
        dismiss()
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
            onDismiss={dismiss}
            selectionText={popoverState?.selectionText}
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
            onEditCancel={() => setPopoverState((s) => (s ? { ...s, mode: 'card' } : s))}
            saving={saving}
            hasReceivedChunk={aiStream.hasReceivedChunk}
          />
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

        applyThemeClass(container)
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const onMediaChange = () => applyThemeClass(container)
        const onStorage = (event: StorageEvent) => {
          if (event.key === THEME_STORAGE_KEY) applyThemeClass(container)
        }
        mediaQuery.addEventListener('change', onMediaChange)
        window.addEventListener('storage', onStorage)

        const reactMount = document.createElement('div')
        reactMount.id = 'vocabify-react-root'
        container.appendChild(reactMount)

        portalContainer = document.createElement('div')
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
      if (isVocabifyUiEvent(event)) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.(`.${NO_SELECTION_CONTAINER}`)) return
      setPopoverStateFn?.(null)
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setPopoverStateFn?.(null)
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
        setPopoverStateFn?.(null)
        return
      }

      const range = selection.getRangeAt(0).cloneRange()
      if (range.collapsed) return

      const rect = getSelectionRect(range)
      if (!rect) return

      const savedId = await lookupSavedRecordId(selectedText)
      if (savedId != null) {
        setPopoverStateFn?.({ rect, mode: 'card', recordId: savedId })
        return
      }

      const sourceContext = extractSourceContext(range)
      setPopoverStateFn?.({ rect, mode: 'operation-bar', selectionText: selectedText, sourceContext })
    })

    // ── Highlight saved vocabulary ──────────────────────────────────────────
    await highlightService.highlightVocabulary()

    let debounceTimer: ReturnType<typeof setTimeout>
    highlightService.observeChanges(() => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => highlightService.highlightVocabulary(), 500)
    })

    // ── Hover on highlighted words ─────────────────────────────────────────
    highlightService.setHoverListener((hit: HoverEvent | null) => {
      if (!hit) {
        setPopoverStateFn?.(null)
        return
      }
      setPopoverStateFn?.({ rect: hit.rect, mode: 'card', recordId: hit.recordId })
    })
  },
})

// ─── Utilities ────────────────────────────────────────────────────────────────

async function lookupSavedRecordId(rawText: string): Promise<number | null> {
  const key = normalizeWordOrPhrase(rawText)
  if (!key) return null
  const record = await db.records.where('wordOrPhrase').equals(key).first()
  return record?.id ?? null
}

function getSelectionRect(range: Range): SelectionRect | null {
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
  const rect = rects[rects.length - 1] || range.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height }
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

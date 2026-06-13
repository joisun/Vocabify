import '@/assets/global.css'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import TooltipBtn, {
  SELECTION_POPOVER_ESTIMATED_HEIGHT,
  type SavedRecordSummary,
  type SelectionRect,
} from './components/TooltipBtn'
import { InPageUI } from '@/components/InPageUI'
import { highlightService, type HoverEvent } from '@/lib/highlightService'
import {
  db,
  markRecord,
  normalizeWordOrPhrase,
  settleAndPersistDecay,
} from '@/lib/vocabifyDb'
import {
  FAMILIARITY_LEVELS,
  getLevel,
  MARK_DELTA,
  type MarkAction,
} from '@/lib/familiarity'
import { NO_SELECTION_CONTAINER } from '@/const'
import { checkIsDisabled } from './utils'

const VOCABIFY_THEME_KEY = 'vocabify-theme'

function resolveTheme(): 'light' | 'dark' {
  try {
    const stored = window.localStorage?.getItem(VOCABIFY_THEME_KEY) as 'light' | 'dark' | 'system' | null
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage may be blocked on some pages
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeClass(target: HTMLElement, theme: 'light' | 'dark') {
  target.classList.toggle('dark', theme === 'dark')
  target.classList.toggle('light', theme === 'light')
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // ── In-page UI React root ───────────────────────────────────────────────
    function InPageUIRoot() {
      const [open, setOpen] = useState(false)
      const [selectedText, setSelectedText] = useState<string | undefined>()
      const [selectionAction, setSelectionAction] = useState<{
        text: string
        rect: SelectionRect
        placement: 'top' | 'bottom'
        savedRecord: SavedRecordSummary | null
        source: 'selection' | 'hover'
      } | null>(null)

      // Listen for messages from popup or content script
      React.useEffect(() => {
        const handler = (msg: any) => {
          if (msg.type === 'openVocabList') {
            setSelectedText(undefined)
            setOpen(true)
          }
          if (msg.type === 'openAIExplanation' && msg.text) {
            setSelectionAction(null)
            setSelectedText(msg.text)
            setOpen(true)
          }
        }
        chrome.runtime.onMessage.addListener(handler)
        return () => chrome.runtime.onMessage.removeListener(handler)
      }, [])

      // Expose handlers globally so the dom listeners outside React can call them
      React.useEffect(() => {
        ;(window as any).__vocabifyOpenAI = (text: string) => {
          setSelectionAction(null)
          setSelectedText(text)
          setOpen(true)
        }

        ;(window as any).__vocabifyShowSelectionAction = (
          text: string,
          rect: SelectionRect,
          placement: 'top' | 'bottom',
          savedRecord: SavedRecordSummary | null,
          source: 'selection' | 'hover' = 'selection',
        ) => {
          setSelectionAction({ text, rect, placement, savedRecord, source })
        }

        ;(window as any).__vocabifyDismissSelectionAction = (force = false) => {
          if (!force) {
            // Hover popovers should not be killed by random page mousedowns;
            // the hover bridge has its own teardown rules.
            // Selection-driven popovers can always be dismissed.
            setSelectionAction((current) => {
              if (current?.source === 'hover') return current
              return null
            })
            return
          }
          setSelectionAction(null)
        }

        return () => {
          delete (window as any).__vocabifyOpenAI
          delete (window as any).__vocabifyShowSelectionAction
          delete (window as any).__vocabifyDismissSelectionAction
        }
      }, [])

      return (
        <>
          <InPageUI open={open} onOpenChange={setOpen} selectedText={selectedText} />
          {selectionAction ? (
            <TooltipBtn
              text={selectionAction.text}
              rect={selectionAction.rect}
              placement={selectionAction.placement}
              savedRecord={selectionAction.savedRecord}
              cancelHandler={() => setSelectionAction(null)}
              vocabifyHandler={(text) => {
                window.getSelection()?.removeAllRanges()
                ;(window as any).__vocabifyOpenAI?.(text)
              }}
              markHandler={async (id, action) => {
                window.getSelection()?.removeAllRanges()
                setSelectionAction(null)
                await applyMarkAction(id, action)
              }}
              onPointerEnter={() => {
                hoverBridge.cancelDismiss()
              }}
              onPointerLeave={() => {
                hoverBridge.scheduleDismiss()
              }}
            />
          ) : null}
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

        // Apply theme class to the shadow container so dark/light tokens cascade.
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

    // ── Selection-driven popover (unsaved word path → AI Explain) ───────────
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
      const savedRecord = await lookupSavedRecord(selectedText)
      ;(window as any).__vocabifyShowSelectionAction?.(
        selectedText,
        rect,
        placement,
        savedRecord,
        'selection',
      )
    })

    // ── Highlight saved vocabulary ──────────────────────────────────────────
    await highlightService.highlightVocabulary()

    // Watch for SPA navigation and re-highlight
    let debounceTimer: ReturnType<typeof setTimeout>
    highlightService.observeChanges(() => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        highlightService.highlightVocabulary()
      }, 500)
    })

    // ── Hover-driven popover (saved word path → mark Know/Fuzzy/Forget) ─────
    const hoverBridge = createHoverBridge()
    highlightService.setHoverListener(async (hit: HoverEvent | null) => {
      if (!hit) {
        hoverBridge.scheduleDismiss()
        return
      }
      hoverBridge.cancelDismiss()
      const record = await db.records.get(hit.recordId)
      if (!record) return
      const settled = await settleAndPersistDecay(record)
      const summary: SavedRecordSummary = {
        id: hit.recordId,
        wordOrPhrase: settled.wordOrPhrase,
        score: settled.score,
        level: getLevel(settled.score),
      }
      const placement = getSelectionActionPlacement(hit.rect)
      ;(window as any).__vocabifyShowSelectionAction?.(
        settled.wordOrPhrase,
        hit.rect,
        placement,
        summary,
        'hover',
      )
    })
  },
})

/**
 * Bridge timer between hover-on-word and hover-on-popover.
 *
 * Monica's trick: if the user moves the cursor from the highlighted word
 * to the popover, we need a small grace window where neither leaving the
 * word nor crossing the gap to the popover will tear the popover down.
 *
 * `scheduleDismiss` and `cancelDismiss` are called from both ends — the
 * highlight hover-out and the popover pointerleave both schedule, while
 * any pointerenter (word or popover) cancels.
 */
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

async function lookupSavedRecord(rawText: string): Promise<SavedRecordSummary | null> {
  const key = normalizeWordOrPhrase(rawText)
  if (!key) return null
  const record = await db.records.where('wordOrPhrase').equals(key).first()
  if (!record || record.id == null) return null
  const settled = await settleAndPersistDecay(record)
  return {
    id: record.id,
    wordOrPhrase: settled.wordOrPhrase,
    score: settled.score,
    level: getLevel(settled.score),
  }
}

async function applyMarkAction(id: number, action: MarkAction) {
  const next = await markRecord(id, action)
  if (!next) return
  const level = getLevel(next.score)
  const meta = FAMILIARITY_LEVELS[level]
  const delta = MARK_DELTA[action]
  showMarkToast(`${meta.label} · ${next.score}`, formatDelta(delta))
  await highlightService.highlightVocabulary()
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
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
  const rect = rects[rects.length - 1] || range.getBoundingClientRect()

  if (!rect || rect.width <= 0 || rect.height <= 0) return null

  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

function isVocabifyUiEvent(event: Event) {
  return event.composedPath().some((node) => {
    return node instanceof HTMLElement && node.classList.contains(NO_SELECTION_CONTAINER)
  })
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

  return {
    top,
    bottom: top + height,
  }
}

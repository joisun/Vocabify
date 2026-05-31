import '@/assets/global.css'
import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import TooltipBtn, {
  SELECTION_POPOVER_ESTIMATED_HEIGHT,
  type SelectionRect,
} from './components/TooltipBtn'
import { InPageUI } from '@/components/InPageUI'
import { highlightService } from '@/lib/highlightService'
import { NO_SELECTION_CONTAINER } from '@/const'
import { checkIsDisabled } from './utils'

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

      // Expose open handler globally so mouseup handler can call it
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
        ) => {
          setSelectionAction({ text, rect, placement })
        }

        ;(window as any).__vocabifyDismissSelectionAction = () => {
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
              cancelHandler={() => setSelectionAction(null)}
              vocabifyHandler={(text) => {
                window.getSelection()?.removeAllRanges()
                ;(window as any).__vocabifyOpenAI?.(text)
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

        const reactMount = document.createElement('div')
        reactMount.id = 'vocabify-react-root'
        container.appendChild(reactMount)

        const portalContainer = document.createElement('div')
        portalContainer.id = 'vocabify-portal-root'
        portalContainer.style.pointerEvents = 'auto'
        shadow.appendChild(portalContainer)

        const root = ReactDOM.createRoot(reactMount)
        root.render(<InPageUIRoot />)
        return root
      },
      onRemove: (root) => root?.unmount(),
    })

    ui.mount()

    // ── Text selection handler ──────────────────────────────────────────────
    document.addEventListener('mousedown', function (event) {
      const target = event.target as HTMLElement | null
      if (isVocabifyUiEvent(event) || target?.closest?.(`.${NO_SELECTION_CONTAINER}`)) return
      ;(window as any).__vocabifyDismissSelectionAction?.()
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        ;(window as any).__vocabifyDismissSelectionAction?.()
      }
    })

    document.addEventListener('mouseup', function (event) {
      const target = event.target as Node
      if (checkIsDisabled(target)) return
      if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA') return
      if ((target as HTMLElement).isContentEditable) return

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
      ;(window as any).__vocabifyShowSelectionAction?.(selectedText, rect, placement)
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
  },
})

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

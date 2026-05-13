import '@/assets/global.css'
import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import TooltipBtn from './components/TooltipBtn'
import { InPageUI } from '@/components/InPageUI'
import { highlightService } from '@/lib/highlightService'
import { hightlightStyle } from '@/utils/storage'
import { checkIsDisabled, isCrossElementsCheck, isSelectionIntersectWithElement } from './utils'

export default defineContentScript({
  matches: ['<all_urls>'],

  async main(ctx) {
    const MARKED_CLASSNAME = 'vocabify-marked-tag'

    // ── Shadow DOM host for In-page UI ──────────────────────────────────────
    const shadowHost = document.createElement('div')
    shadowHost.id = 'vocabify-root'
    Object.assign(shadowHost.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
    document.body.appendChild(shadowHost)

    const shadowRoot = shadowHost.attachShadow({ mode: 'open' })

    // Inject Tailwind styles into shadow root
    const styleEl = document.createElement('link')
    styleEl.rel = 'stylesheet'
    styleEl.href = chrome.runtime.getURL('content-scripts/content.css')
    shadowRoot.appendChild(styleEl)

    const appContainer = document.createElement('div')
    appContainer.style.pointerEvents = 'auto'
    shadowRoot.appendChild(appContainer)

    // ── In-page UI React root ───────────────────────────────────────────────
    function InPageUIRoot() {
      const [open, setOpen] = useState(false)
      const [selectedText, setSelectedText] = useState<string | undefined>()

      // Listen for messages from popup or content script
      React.useEffect(() => {
        const handler = (msg: any) => {
          if (msg.type === 'openVocabList') {
            setSelectedText(undefined)
            setOpen(true)
          }
          if (msg.type === 'openAIExplanation' && msg.text) {
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
          setSelectedText(text)
          setOpen(true)
        }
      }, [])

      return <InPageUI open={open} onOpenChange={setOpen} selectedText={selectedText} />
    }

    ReactDOM.createRoot(appContainer).render(<InPageUIRoot />)

    // ── Text selection handler ──────────────────────────────────────────────
    document.addEventListener('mouseup', function (event) {
      const target = event.target as Node
      if (checkIsDisabled(target)) return
      if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA') return

      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const selectedText = selection.toString().trim()
      if (!selectedText) return

      const { anchorNode, focusOffset, anchorOffset } = selection
      if (!anchorNode) return

      const selectionStart = Math.min(focusOffset, anchorOffset)
      const selectionEnd = Math.max(focusOffset, anchorOffset)

      if (isSelectionIntersectWithElement(selection, MARKED_CLASSNAME)) return
      if (isCrossElementsCheck(selection)) return

      const wrapper = document.createElement('span')
      wrapper.className = MARKED_CLASSNAME

      const range = document.createRange()
      range.setStart(anchorNode, selectionStart)
      range.setEnd(anchorNode, selectionEnd)
      range.deleteContents()
      range.insertNode(wrapper)

      function cancelHandler(text: string) {
        if (
          wrapper.previousSibling?.nodeType === Node.TEXT_NODE &&
          wrapper.nextSibling?.nodeType === Node.TEXT_NODE &&
          wrapper.previousSibling?.nodeValue !== '' &&
          wrapper.nextSibling?.nodeValue !== ''
        ) {
          const newText = (wrapper.previousSibling.textContent || '') + text + (wrapper.nextSibling.textContent || '')
          const newNode = document.createTextNode(newText)
          wrapper.previousSibling.remove()
          wrapper.nextSibling.remove()
          wrapper.parentNode?.insertBefore(newNode, wrapper)
        } else if (wrapper.previousSibling?.nodeType === Node.TEXT_NODE && wrapper.previousSibling?.nodeValue !== '') {
          wrapper.previousSibling.textContent += text
        } else if (wrapper.nextSibling?.nodeType === Node.TEXT_NODE && wrapper.nextSibling?.nodeValue !== '') {
          wrapper.nextSibling.textContent = text + wrapper.nextSibling.textContent
        } else {
          wrapper.parentNode?.insertBefore(document.createTextNode(text), wrapper)
        }
        wrapper.remove()
        ui.remove()
      }

      function vocabifyHandler(text: string) {
        ui.remove()
        // Open In-page UI with AI explanation
        ;(window as any).__vocabifyOpenAI?.(text)
      }

      const ui = createIntegratedUi(ctx, {
        position: 'inline',
        anchor: 'body',
        onMount: () => {
          const root = ReactDOM.createRoot(wrapper)
          root.render(<TooltipBtn text={selectedText} cancelHandler={cancelHandler} vocabifyHandler={vocabifyHandler} />)
          return root
        },
        onRemove: (root) => root?.unmount(),
      })

      ui.mount()
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

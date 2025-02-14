import '@/assets/global.css'
import ReactDOM from 'react-dom/client'
import TooltipBtn from './components/TooltipBtn'
import TooltipIndicator from './components/TooltipIndicator'

import { highlightStyleSettingsType } from '@/utils/storage'
import { checkIsDisabled, getAllTextNodes, isCrossElementsCheck, isSelectionIntersectWithElement } from './utils'
export default defineContentScript({
  matches: ['<all_urls>'],

  async main(ctx) {
    // 监听文本选择事件
    console.log('Hello content.')
    const MARKED_CLASSNAME = 'vocabify-marked-tag'
    document.addEventListener('mouseup', function (event) {
      const target = event.target as Node
      // 某些元素可能不需要用户选中，例如回显
      const isDisabled = checkIsDisabled(target)
      if (isDisabled) return

      // 如果时输入框，不做处理
      if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA') return

      // if targetNode not exist or is not textNode or textContent is empty, then return
      const selection = window.getSelection()
      // if selection content is empty, then return
      if (!selection || !selection.rangeCount) return
      const selectedText = selection.toString()
      // if select text is empty, then return
      if (!selectedText) return

      const { anchorNode, focusOffset, anchorOffset } = selection
      if (!anchorNode) return

      // User may selection from left to right or right to left
      const selectionStart = Math.min(focusOffset, anchorOffset)
      const selectionEnd = Math.max(focusOffset, anchorOffset)

      // Check if selected part is interacted with already marked part
      const isInteracted = isSelectionIntersectWithElement(selection, MARKED_CLASSNAME)
      // Check if selected part is cross multi elements area
      const isCrossElements = isCrossElementsCheck(selection)
      if (isInteracted) return
      if (isCrossElements) return

      // Create a mount point for react Component
      const wrapper = document.createElement('span')
      wrapper.className = MARKED_CLASSNAME
      // wrapper.style.color = 'yellow'

      // create range to replace selected text
      const range = document.createRange()
      range.setStart(anchorNode, selectionStart)
      range.setEnd(anchorNode, selectionEnd)

      // delete text node and insert
      range.deleteContents()
      range.insertNode(wrapper)

      // cancel handler
      function cancelHandler(selectionText: string) {
        // 以下操作目的，都是为了在取消的时候，将原来的文本还原成单个 textNode， 否则取消后，第二次选中时可能会存在一些意外问题。
        // 如果前后都有文本，那么就应该将前后文本和还原选中的文本拼接为一个 textNode
        if (
          wrapper.previousSibling?.nodeType === Node.TEXT_NODE &&
          wrapper.nextSibling?.nodeType === Node.TEXT_NODE &&
          wrapper.previousSibling?.nodeValue !== '' &&
          wrapper.nextSibling?.nodeValue !== ''
        ) {
          // 前后都有文本节点的情况
          // 创建新的 textNode
          const prevText = wrapper.previousSibling.textContent || ''
          const nextText = wrapper.nextSibling.textContent || ''
          const newText = prevText + selectionText + nextText
          const newTextNode = document.createTextNode(newText)
          wrapper.previousSibling.remove()
          wrapper.nextSibling.remove()
          wrapper.parentNode?.insertBefore(newTextNode, wrapper)
          // wrapper.parentNode?.removeChild(wrapper);
          // wrapper.previousSibling?.parentNode?.removeChild(wrapper.previousSibling);
          // wrapper.nextSibling?.parentNode?.removeChild(wrapper.nextSibling);
        } else if (wrapper.previousSibling?.nodeType === Node.TEXT_NODE && wrapper.previousSibling?.nodeValue !== '') {
          // 只有前方有文本节点的情况
          wrapper.previousSibling.textContent += selectionText
        } else if (wrapper.nextSibling?.nodeType === Node.TEXT_NODE && wrapper.nextSibling?.nodeValue !== '') {
          // 只有后方有文本节点的情况
          wrapper.nextSibling.textContent = selectionText + wrapper.nextSibling.textContent
        } else {
          // 前后都没有文本节点的情况
          const textNode = document.createTextNode(selectionText)
          wrapper.parentNode?.insertBefore(textNode, wrapper)
        }

        wrapper.remove()
        ui.remove()
      }

      async function vocabifyHandler(text: string) {
        chrome.runtime.sendMessage({
          action: 'triggerSelection',
          payload: selectedText,
        })
      }

      const ui = createIntegratedUi(ctx, {
        position: 'inline',
        anchor: 'body',
        onMount: (container) => {
          // Create a root on the UI container and render a component
          const root = ReactDOM.createRoot(wrapper)
          root.render(<TooltipBtn text={selectedText} cancelHandler={cancelHandler} vocabifyHandler={vocabifyHandler} />)
          return root
        },
        onRemove: (root) => {
          // Unmount the root when the UI is removed
          root?.unmount()
        },
      })

      // Call mount to add the UI to the DOM
      ui.mount()
    })

    await hightlightRecords()
  },
})

async function hightlightRecords() {
  // get all text nodes
  const nodes = getAllTextNodes()

  // get all records data
  let records = []
  const response = await chrome.runtime.sendMessage({
    action: 'getAllRecordsData',
  })
  if (response.status === 'success') {
    records = response.message
  }

  let highlightStyleSettings = null
  const highlightStyleSettingsResponse = await chrome.runtime.sendMessage({
    action: 'getHighlightStyleSettings',
  })

  if (highlightStyleSettingsResponse.status === 'success') {
    highlightStyleSettings = highlightStyleSettingsResponse.message
  }

  // hightlight
  highlightWords(records, nodes, highlightStyleSettings)
}

export function highlightWords(records: any[], nodes: ChildNode[], highlightStyleSettings: highlightStyleSettingsType) {
  type Modification = {
    matchIndex: number
    matchText: string
    length: number
    record: {
      id: number
      createAt: string
      updateAt: string
      wordOrPhrase: string
      meaning: string
    }
  }
  const t0 = performance.now()

  // Traverse all text nodes
  nodes.forEach((node) => {
    let text = node.nodeValue
    if (!text?.trim()) return

    const range = document.createRange()
    const modifications: Modification[] = [] // Track match info (index and length)

    const regexes = records.map((record) => {
      const wordOrPhrase = record.wordOrPhrase
      const isWholeWord = /^[a-zA-Z]+$/.test(wordOrPhrase)
      const pattern = isWholeWord ? `\\b${wordOrPhrase}\\b` : wordOrPhrase
      return {
        regex: new RegExp(pattern, 'gi'),
        record,
      }
    })

    regexes.forEach(({ record, regex }) => {
      const matches = [...text.matchAll(regex)]

      // Store match info (start index and length) to avoid modifying node during iteration
      matches.forEach((match) => {
        const matchIndex = match.index
        const matchText = match[0]
        // Store match details (index and length)
        modifications.push({ matchIndex, matchText, record, length: matchText.length })
      })
    })

    // Sort modifications by match index in reverse order to prevent affecting earlier matches
    modifications.sort((a, b) => b.matchIndex - a.matchIndex)

    // Process modifications in reverse order to avoid messing with indices
    modifications.forEach(({ matchIndex, matchText, record }) => {
      /**
       * 如果文本中同时存在短的命中文本，和长的命中文本。 那么短的可能将原始文本阶段阶段
       * 短的匹配会改变文本的结构，导致后续匹配失败或报错
       * 例如 Importing and Exporting Components 同时命中文本 “on” 和 “components”
       * 那么这时在操作的 component 的标记的时候，就会报错。
       * 为此，为了解决这个问题，可以使用贪婪匹配策略，即优先处理长的匹配，确保短的匹配不会截断长的匹配。
       */
      if (modifications.length && node.nodeValue === 'Importing and Exporting Components') {
        console.log('node', node.nodeName)
      }
      // Create a container for the TooltipIndicator component
      const container = document.createElement('span')
      try {
        // Set the range to the current match
        range.setStart(node, matchIndex)
        range.setEnd(node, matchIndex + matchText.length)

        // Delete the matched contents and insert the container
        range.deleteContents()
        range.insertNode(container)
      } catch (err) {
        console.error('err', err)
      }

      // Use ReactDOM to render TooltipIndicator inside the container
      const root = ReactDOM.createRoot(container)
      root.render(
        <TooltipIndicator
          record={record}
          text={matchText}
          cancelHandler={() => console.log('Cancel clicked')}
          vocabifyHandler={() => console.log('Vocabify clicked')}
          highlightStyleSettings={highlightStyleSettings}
        />
      )
    })
  })

  const t1 = performance.now()
  console.log(`Call to highlightWords took ${t1 - t0} milliseconds.`)
}

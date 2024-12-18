import '@/assets/global.css'
import ReactDOM from 'react-dom/client'
import TooltipBtn from './components/TooltipBtn'
import TooltipIndicator from './components/TooltipIndicator'

import { getAllTextNodes, isCrossElementsCheck, isSelectionIntersectWithElement } from './utils'
import VocabifyIndexDB from '@/lib/db'
export default defineContentScript({
  matches: ['<all_urls>'],

  async main(ctx) {
    // 监听文本选择事件
    console.log('Hello content.')
    const MARKED_CLASSNAME = 'vocabify-marked-tag'
    document.addEventListener('mouseup', function (event) {
      const target = event.target as Node
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
      wrapper.style.color = 'yellow'

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

      function vocabifyHandler(text: string) {
        // send message to background to open side panel
        // chrome.runtime.sendMessage({
        //   action: 'openSidePanel',
        //   payload: selectedText
        // });

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

  // hightlight
  highlightWords(records, nodes)
}

export function highlightWords(records: any[], nodes: ChildNode[]) {
  console.log('records', records)
  const t0 = performance.now()

  // 遍历所有文本节点
  nodes.forEach((node) => {
    let text = node.nodeValue
    if (!text?.trim()) return

    records.forEach((record) => {
      const word = record.wordOrPhrase
      const regex = new RegExp(word, 'gi') // 创建不区分大小写的正则表达式

      // 如果文本中有匹配的词
      if (regex.test(text)) {
        // 用正则匹配多个部分并替换文本
        const parts = text.split(regex)
        const matches = text.match(regex)

        const fragment = document.createDocumentFragment()

        parts.forEach((part, index) => {
          fragment.appendChild(document.createTextNode(part))

          if (matches && matches[index]) {
            // 创建一个容器，用于包裹 TooltipBtn 组件
            const container = document.createElement('span')
            const selectedText = matches[index]

            // 使用 ReactDOM 创建根节点并渲染 TooltipBtn
            const root = ReactDOM.createRoot(container)
            root.render(
              <TooltipIndicator record={record} text={selectedText} cancelHandler={() => console.log('Cancel clicked')} vocabifyHandler={() => console.log('Vocabify clicked')} />
            )

            // 将组件容器插入到文档片段中
            fragment.appendChild(container)
          }
        })

        // 替换原文本节点为包含 TooltipBtn 的内容
        node.replaceWith(fragment)
      }
    })
  })

  const t1 = performance.now()
  console.log(`Call to highlightWords took ${t1 - t0} milliseconds.`)
}

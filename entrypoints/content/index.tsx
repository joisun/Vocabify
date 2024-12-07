import "@/assets/global.css";
import ReactDOM from "react-dom/client";
import TooltipBtn from "./components/TooltipBtn";
import { isCrossElementsCheck, isSelectionIntersectWithElement } from "./utils";
export default defineContentScript({
  matches: ["<all_urls>"],

  main(ctx) {
    // 监听文本选择事件
    console.log("Hello content.");
    const MARKED_CLASSNAME = "vocabify-marked-tag";
    document.addEventListener("mouseup", function (event) {
      const target = event.target as Node;
      // if targetNode not exist or is not textNode or textContent is empty, then return
      const selection = window.getSelection();
      // if selection content is empty, then return
      if (!selection || !selection.rangeCount) return;
      const selectedText = selection.toString();
      // if select text is empty, then return
      if (!selectedText) return;

      const { anchorNode, focusOffset, anchorOffset } = selection;
      if (!anchorNode) return

      // User may selection from left to right or right to left
      const selectionStart = Math.min(focusOffset, anchorOffset);
      const selectionEnd = Math.max(focusOffset, anchorOffset);

      // Check if selected part is interacted with already marked part
      const isInteracted = isSelectionIntersectWithElement(
        selection,
        MARKED_CLASSNAME
      );
      // Check if selected part is cross multi elements area
      const isCrossElements = isCrossElementsCheck(selection)
      if (isInteracted) return;
      if (isCrossElements) return;

      // Create a mount point for react Component
      const wrapper = document.createElement("span");
      wrapper.className = MARKED_CLASSNAME;
      wrapper.style.color = 'yellow'

      // create range to replace selected text
      const range = document.createRange();
      range.setStart(anchorNode, selectionStart);
      range.setEnd(anchorNode, selectionEnd);

      // delete text node and insert
      range.deleteContents();
      range.insertNode(wrapper);



      // cancel handler
      function cancelHandler(selectionText: string) {
        // 以下操作目的，都是为了在取消的时候，将原来的文本还原成单个 textNode， 否则取消后，第二次选中时可能会存在一些意外问题。
        // 如果前后都有文本，那么就应该将前后文本和还原选中的文本拼接为一个 textNode
        if (wrapper.previousSibling?.nodeType === Node.TEXT_NODE && wrapper.nextSibling?.nodeType === Node.TEXT_NODE && wrapper.previousSibling?.nodeValue !== '' && wrapper.nextSibling?.nodeValue !== '') {
          // 前后都有文本节点的情况
          // 创建新的 textNode
          const prevText = wrapper.previousSibling.textContent || '';
          const nextText = wrapper.nextSibling.textContent || '';
          const newText = prevText + selectionText + nextText;
          const newTextNode = document.createTextNode(newText);
          wrapper.previousSibling.remove()
          wrapper.nextSibling.remove()
          wrapper.parentNode?.insertBefore(newTextNode, wrapper);
          // wrapper.parentNode?.removeChild(wrapper);
          // wrapper.previousSibling?.parentNode?.removeChild(wrapper.previousSibling);
          // wrapper.nextSibling?.parentNode?.removeChild(wrapper.nextSibling);

        } else if (wrapper.previousSibling?.nodeType === Node.TEXT_NODE && wrapper.previousSibling?.nodeValue !== '') {
          // 只有前方有文本节点的情况
          wrapper.previousSibling.textContent += selectionText;
        } else if (wrapper.nextSibling?.nodeType === Node.TEXT_NODE && wrapper.nextSibling?.nodeValue !== '') {
          // 只有后方有文本节点的情况
          wrapper.nextSibling.textContent = selectionText + wrapper.nextSibling.textContent;
        } else {
          // 前后都没有文本节点的情况
          const textNode = document.createTextNode(selectionText);
          wrapper.parentNode?.insertBefore(textNode, wrapper);
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
          action: 'sendToAi',
          payload: selectedText
        });

      }


      const ui = createIntegratedUi(ctx, {
        position: "inline",
        anchor: "body",
        onMount: (container) => {
          // Create a root on the UI container and render a component
          const root = ReactDOM.createRoot(wrapper);
          root.render(<TooltipBtn text={selectedText} cancelHandler={cancelHandler} vocabifyHandler={vocabifyHandler} />);
          return root;
        },
        onRemove: (root) => {
          // Unmount the root when the UI is removed
          root?.unmount();
        },
      });

      // Call mount to add the UI to the DOM
      ui.mount();


    });
  },
});

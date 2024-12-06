import "@/assets/global.css";
import ReactDOM from "react-dom/client";
import TooltipBtn from "./components/TooltipBtn";
import { isSelectionIntersectWithElement } from "./utils";
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
      const selectionStart = Math.min(focusOffset, anchorOffset);
      const selectionEnd = Math.max(focusOffset, anchorOffset);
      const isInteracted = isSelectionIntersectWithElement(
        selection,
        MARKED_CLASSNAME
      );
      console.log("isInteracted", isInteracted);
      if (isInteracted) return;


      const wrapper = document.createElement("span");
      wrapper.className = MARKED_CLASSNAME;
      wrapper.style.color = 'yellow'
      wrapper.textContent = selectedText;

      // create range to replace selected text
      const range = document.createRange();
      range.setStart(anchorNode, selectionStart);
      range.setEnd(anchorNode, selectionEnd);

      // delete text node and insert
      range.deleteContents();
      range.insertNode(wrapper);


      const ui = createIntegratedUi(ctx, {
        position: "inline",
        anchor: "body",
        onMount: (container) => {
          // Create a root on the UI container and render a component
          const root = ReactDOM.createRoot(wrapper);
          root.render(<TooltipBtn text={selectedText} />);
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

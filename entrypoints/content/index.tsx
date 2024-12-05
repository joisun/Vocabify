import ReactDOM from "react-dom/client";
import "@/assets/global.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
export default defineContentScript({
  matches: ["<all_urls>"],

  main(ctx) {
    // 监听文本选择事件
    console.log("Hello content.");
    document.addEventListener("mouseup", function (event) {
      const selectedText = window.getSelection()?.toString().trim();
      if (selectedText) {
        // 创建 tooltip 并显示
        // createTooltip(selectedText, event.clientX, event.clientY);
        const ui = createIntegratedUi(ctx, {
          position: "inline",
          anchor: "body",
          onMount: (container) => {
            // Create a root on the UI container and render a component
            console.log("container", container);
            function ToolTip() {
              return (
                <div style={{
                  position: "absolute",
                  left: event.clientX,
                  top: event.clientY,
                }}>
                  <TooltipProvider >
                    <Tooltip>
                      <TooltipTrigger>
                        <button className="text-red-600">Hover</button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add to library</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            }
            const root = ReactDOM.createRoot(container);
            root.render(<ToolTip />);
            return root;
          },
          onRemove: (root) => {
            // Unmount the root when the UI is removed
            root?.unmount();
          },
        });

        // Call mount to add the UI to the DOM
        ui.mount();
      }
    });
  },
});

// export default defineContentScript({
//   matches: ['*://*/*'],
//   main() {
//     console.log('Hello content.');

// // 监听文本选择事件
// document.addEventListener('mouseup', function (event) {
//   const selectedText = window.getSelection()?.toString().trim();

//   if (selectedText) {
//     // 创建 tooltip 并显示
//     // createTooltip(selectedText, event.clientX, event.clientY);
//   }
// });

// // 创建 tooltip
// // function createTooltip(word, x, y) {
// //   // 如果已有 tooltip，先删除
// //   const existingTooltip = document.getElementById('custom-tooltip');
// //   if (existingTooltip) {
// //     existingTooltip.remove();
// //   }

// //   // 创建一个新的 tooltip 元素
// //   const tooltip = document.createElement('div');
// //   tooltip.id = 'custom-tooltip';
// //   tooltip.style.position = 'absolute';
// //   tooltip.style.left = `${x + 10}px`; // tooltip 距离鼠标稍微偏移
// //   tooltip.style.top = `${y + 10}px`;
// //   tooltip.style.padding = '8px';
// //   tooltip.style.backgroundColor = '#333';
// //   tooltip.style.color = 'white';
// //   tooltip.style.borderRadius = '4px';
// //   tooltip.style.fontSize = '14px';
// //   tooltip.style.zIndex = '10000';  // 确保 tooltip 在最前面显示

// //   tooltip.innerHTML = `
// //     <span>${word}</span><br>
// //     <button id="add-to-vocabulary">添加至词库</button>
// //   `;

// //   // 将 tooltip 添加到页面
// //   document.body.appendChild(tooltip);

// //   // 添加点击事件，点击按钮时将词汇添加到词库
// //   document.getElementById('add-to-vocabulary')?.addEventListener('click', function () {
// //     // 发送消息给 background script
// //     chrome.runtime.sendMessage({
// //       action: 'addWordToVocabulary',
// //       word: word
// //     });
// //     tooltip.remove();  // 点击后关闭 tooltip
// //   });
// // }
//   }
// });

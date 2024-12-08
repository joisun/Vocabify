/**
 * https://stackoverflow.com/questions/77734376/indexeddb-not-showing-in-chrome-dev-tools#comment137042151_77734376
 * 在 插件的 Service Workder 中看不到 IndexedDB, 可以在 side panel 的控制台中看到
 */
import VocabifyIndexDB from "@/lib/db";
import { AiApiAdaptor } from "./options/aiModels";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.create({ url: "https://react.dev/learn/render-and-commit" });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { payload } = message;
    const MessageHandler = {
      saveWord: () => {
        console.log("saveWpord:", payload);
        const db = new VocabifyIndexDB();
        db.addData({
          id: 1, // 主键
          word: "example",
          meaning: "示例",
          timestamp: Date.now(),
        })
          .then(console.log)
          .catch(console.error);
      },
      openSidePanel: async () => {
        if (!sender.tab) return;
        await chrome.sidePanel.open({
          tabId: sender.tab.id,
          windowId: sender.tab.windowId,
        });
      },
      triggerSelection: async () => {
        await MessageHandler.openSidePanel();
        chrome.runtime.sendMessage({ action: "sendToAi", payload });
      },
    };

    const action = message.action as keyof typeof MessageHandler;
    MessageHandler[action] && MessageHandler[action]();
  });
});

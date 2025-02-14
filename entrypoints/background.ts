/**
 * https://stackoverflow.com/questions/77734376/indexeddb-not-showing-in-chrome-dev-tools#comment137042151_77734376
 * 在 插件的 Service Workder 中看不到 IndexedDB, 可以在 side panel 的控制台中看到
 */
import VocabifyIndexDB from '@/lib/db'
import { firstCheckRecord, firstSelection } from '@/utils/storage'
export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id })

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error))

  // chrome.runtime.onInstalled.addListener(() => {
  //   chrome.tabs.create({ url: 'https://react.dev/learn/render-and-commit' })
  // })

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { payload } = message
    const MessageHandler = {
      saveWordOrPhrase: async () => {
        try {
          const db = new VocabifyIndexDB()

          db.addOrUpdateData(payload)
            .then((res) => {
              sendResponse({
                status: 'success',
                message: res,
              })
            })
            .catch((error) => {
              sendResponse({
                status: 'error',
                message: error,
              })
            })
        } catch (err) {
          sendResponse({
            status: 'error',
            message: 'Vocabify Data Base Init error. Please Contact the developer.',
          })
        }
      },
      findByPage: async () => {
        try {
          const db = new VocabifyIndexDB()
          const { pageNum, pageSize } = payload
          db.findByPage(pageNum, pageSize)
            .then((res) => {
              sendResponse({
                status: 'success',
                message: res,
              })
            })
            .catch((error) => {
              sendResponse({
                status: 'error',
                message: error,
              })
            })
        } catch (err) {
          sendResponse({
            status: 'error',
            message: 'Vocabify Data Base Init error. Please Contact the developer.',
          })
        }
      },
      fuzzySearchByKeyword: async () => {
        try {
          const db = new VocabifyIndexDB()
          db.fuzzySearchByKeyword(payload)
            .then((res) => {
              sendResponse({
                status: 'success',
                message: res,
              })
            })
            .catch((error) => {
              sendResponse({
                status: 'error',
                message: error,
              })
            })
        } catch (err) {
          sendResponse({
            status: 'error',
            message: 'Vocabify Data Base Init error. Please Contact the developer.',
          })
        }
      },
      deleteWordOrPhrase: async () => {
        try {
          const db = new VocabifyIndexDB()
          db.deleteData(payload.wordOrPhrase)
            .then((res) => {
              sendResponse({
                status: 'success',
                message: res,
              })
            })
            .catch((error) => {
              sendResponse({
                status: 'error',
                message: error,
              })
            })
        } catch (err) {
          sendResponse({
            status: 'error',
            message: 'Vocabify Data Base Init error. Please Contact the developer.',
          })
        }
      },
      openSidePanel: async () => {
        if (!sender.tab) return
        await chrome.sidePanel.open({
          tabId: sender.tab.id,
          windowId: sender.tab.windowId,
        })
      },
      triggerSelection: async () => {
        await MessageHandler.openSidePanel()

        /**
         * 当用户首次选中文本，而没有事先打开 side panel 的时候，sidepanel 内的消息监听还没有初始化， 所以首次 消息是监听不到的。
         * 为了解决这个问题，将用户首次选中的词汇缓存下来。 待 side panel 首次挂载的时候， 在  side panle 中取出执行。
         */
        firstSelection.setValue(payload)
        chrome.runtime.sendMessage({ action: 'sendToAi', payload })
      },
      triggerCheck: async () => {
        await MessageHandler.openSidePanel()

        /**
         * 当用户首次选中文本，而没有事先打开 side panel 的时候，sidepanel 内的消息监听还没有初始化， 所以首次 消息是监听不到的。
         * 为了解决这个问题，将用户首次选中的词汇缓存下来。 待 side panel 首次挂载的时候， 在  side panle 中取出执行。
         */
        firstCheckRecord.setValue(payload)
        chrome.runtime.sendMessage({ action: 'checkWord', payload })
      },
      getAllRecordsData: async () => {
        try {
          const db = new VocabifyIndexDB()
          db.getAllData()
            .then((res) => {
              sendResponse({
                status: 'success',
                message: res,
              })
            })
            .catch((error) => {
              sendResponse({
                status: 'error',
                message: error,
              })
            })
        } catch (err) {
          sendResponse({
            status: 'error',
            message: 'Vocabify Data Base Init error. Please Contact the developer.',
          })
        }
      },
      getHighlightStyleSettings: async () => {
        try {
          hightlightStyle.getValue().then((res) => {
            if (res) {
              sendResponse({
                status: 'success',
                message: res,
              })
            }
          })
        } catch (err) {
          sendResponse({
            status: 'error',
            message: 'Vocabify Data Base Init error. Please Contact the developer.',
          })
        }
      },
    }

    const action = message.action as keyof typeof MessageHandler
    MessageHandler[action] && MessageHandler[action]()

    // https://developer.chrome.com/docs/extensions/develop/concepts/messaging#simple
    return true
  })
})

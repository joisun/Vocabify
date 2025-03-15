/**
 * https://stackoverflow.com/questions/77734376/indexeddb-not-showing-in-chrome-dev-tools#comment137042151_77734376
 * 在 插件的 Service Workder 中看不到 IndexedDB, 可以在 side panel 的控制台中看到
 */
import VocabifyIndexDB from '@/lib/db'
import { onMessage, sendMessageWithResponse } from '@/lib/messaging'
import { firstCheckRecord, firstSelection } from '@/utils/storage'
export default defineBackground(() => {
  /** Global Variables */
  let isSidePanelPrepared = false
  /** Global Variables End*/

  console.log('Hello background!', { id: browser.runtime.id })
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error))

  chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.create({ url: 'https://react.dev/learn/render-and-commit' })
  })
  // Handle saving word or phrase
  onMessage('saveWordOrPhrase', async ({ data }) => {
    try {
      const db = new VocabifyIndexDB()
      return await db.addOrUpdateData(data)
    } catch (err) {
      throw new Error('Vocabify Data Base Init error. Please Contact the developer.')
    }
  })

  // Handle pagination query
  onMessage('findByPage', async ({ data }) => {
    try {
      const db = new VocabifyIndexDB()
      const { pageNum, pageSize } = data
      return await db.findByPage(pageNum, pageSize)
    } catch (err) {
      throw new Error('Vocabify Data Base Init error. Please Contact the developer.')
    }
  })

  // Handle fuzzy search
  onMessage('fuzzySearchByKeyword', async ({ data }) => {
    try {
      const db = new VocabifyIndexDB()
      return await db.fuzzySearchByKeyword(data)
    } catch (err) {
      throw new Error('Vocabify Data Base Init error. Please Contact the developer.')
    }
  })

  // Handle deleting word or phrase
  onMessage('deleteWordOrPhrase', async ({ data }) => {
    try {
      const db = new VocabifyIndexDB()
      return await db.deleteData(data.wordOrPhrase)
    } catch (err) {
      throw new Error('Vocabify Data Base Init error. Please Contact the developer.')
    }
  })

  // Handle opening side panel
  onMessage('openSidePanel', async (message) => {
    const tab = message.sender.tab;
    if (!tab?.id || !tab.windowId) return;

    await chrome.sidePanel.open({
      tabId: tab.id,
      windowId: tab.windowId,
    });
  });

  // Handle trigger selection
  onMessage('triggerSelection', async (message) => {
    if (isSidePanelPrepared) {
      // Forward message to AI handler
      await sendMessageWithResponse('sendToAi', message.data)
    } else {
      // Cache selection for side panel to use when it initializes
      firstSelection.setValue(message.data)
      const tab = message.sender.tab;
      if (!tab?.id || !tab.windowId) return;
      // Open side panel
      await chrome.sidePanel.open({
        tabId: tab.id,
        windowId: tab.windowId,
      })
    }


  })

  // Handle side panel prepared
  onMessage('sidePanelPrepared', async (message) => {
    isSidePanelPrepared = true
    const cachedSelection = await firstSelection.getValue()
    cachedSelection && sendMessageWithResponse('sendToAi', cachedSelection)
    firstSelection.removeValue()

  })

  // Handle side panel closed
  onMessage('sidePanelClosed', async (message) => {
    isSidePanelPrepared = false
  })

  // Handle trigger check
  onMessage('triggerCheck', async (message) => {
    const tab = message.sender.tab;
    if (!tab?.id || !tab.windowId) return;
    // Open side panel
    await chrome.sidePanel.open({
      tabId: tab.id,
      windowId: tab.windowId,
    })

    // Cache check word for side panel to use when it initializes
    firstCheckRecord.setValue(message.data)

    // Forward message to check word handler
    await sendMessageWithResponse('checkWord', message.data)
  })

  // Handle getting all records
  onMessage('getAllRecordsData', async (message) => {
    try {
      const db = new VocabifyIndexDB()
      return await db.getAllData()
    } catch (err) {
      throw new Error('Vocabify Data Base Init error. Please Contact the developer.')
    }
  })

  // Handle getting highlight style settings
  onMessage('getHighlightStyleSettings', async () => {
    try {
      const result = await hightlightStyle.getValue()
      return result || null
    } catch (err) {
      throw new Error('Vocabify Data Base Init error. Please Contact the developer.')
    }
  })



  // Handle checkWord message
  onMessage('checkWord', async ({ data }) => {
    console.log('Checking word:', data)
    // Implementation for word checking would go here
  })
})

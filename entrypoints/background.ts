import { onMessage } from '@/lib/messaging'
import { hightlightStyle } from '@/utils/storage'
import { aiService } from '@/lib/aiService'

export default defineBackground(() => {
  console.log('Vocabify background started', { id: browser.runtime.id })

  // Handle getting highlight style settings
  onMessage('getHighlightStyleSettings', async () => {
    return (await hightlightStyle.getValue()) || null
  })

  // Handle trigger selection - will be used for AI streaming via Port
  onMessage('triggerSelection', async (message) => {
    return { status: 'ok' as const }
  })

  // Handle AI streaming via Port
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'ai-stream') {
      let disconnected = false
      const abortController = new AbortController()
      const postToPort = (message: unknown) => {
        if (disconnected) return
        try {
          port.postMessage(message)
        } catch (error) {
          disconnected = true
          console.warn('AI stream port is no longer available:', error)
        }
      }

      port.onDisconnect.addListener(() => {
        disconnected = true
        abortController.abort()
      })

      port.onMessage.addListener(async (msg) => {
        if (msg.type === 'start' && msg.text) {
          try {
            await aiService.streamExplanation({
              text: msg.text,
              abortSignal: abortController.signal,
              onChunk: (chunk) => {
                postToPort({ type: 'chunk', chunk })
              },
              onComplete: (fullText) => {
                postToPort({ type: 'complete', fullText })
              },
              onError: (error) => {
                postToPort({ type: 'error', error: error.message })
              }
            })
          } catch (error) {
            postToPort({
              type: 'error',
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      })
    }
  })
})

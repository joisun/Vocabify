import { synthesizeEdgeTts } from '@/lib/edgeTts'

type EdgeTtsRequest = {
  type: 'edgeTtsOffscreenSpeak'
  data: {
    text: string
    voice: string
    rate: number
    pitch: number
    volume: number
  }
}

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null

chrome.runtime.onMessage.addListener((message: EdgeTtsRequest, _sender, sendResponse) => {
  if (message.type !== 'edgeTtsOffscreenSpeak') return

  ;(async () => {
    try {
      const result = await synthesizeEdgeTts(message.data)
      await playAudio(result.audioBase64, result.contentType, message.data.volume)
      sendResponse({ status: 'ok' as const })
    } catch (error) {
      sendResponse({
        status: 'error' as const,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })()

  return true
})

async function playAudio(base64: string, contentType: string, volume: number) {
  stopCurrentAudio()

  const blob = base64ToBlob(base64, contentType)
  const objectUrl = URL.createObjectURL(blob)
  currentObjectUrl = objectUrl
  currentAudio = new Audio(objectUrl)
  currentAudio.volume = Math.max(0, Math.min(1, volume))

  await new Promise<void>((resolve, reject) => {
    const audio = currentAudio
    if (!audio) {
      reject(new Error('Audio playback was not initialized'))
      return
    }

    audio.onended = () => {
      releaseObjectUrl(objectUrl)
      resolve()
    }
    audio.onerror = () => {
      releaseObjectUrl(objectUrl)
      reject(new Error('Edge TTS audio playback failed'))
    }
    audio.play().catch((error) => {
      releaseObjectUrl(objectUrl)
      reject(error)
    })
  })
}

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }

  if (currentObjectUrl) {
    releaseObjectUrl(currentObjectUrl)
  }
}

function releaseObjectUrl(url: string) {
  URL.revokeObjectURL(url)
  if (currentObjectUrl === url) currentObjectUrl = null
}

function base64ToBlob(base64: string, contentType: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

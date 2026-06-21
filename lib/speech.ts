import { sendMessage } from '@/lib/messaging'
import {
  normalizeSpeechSettings,
  speechSettings,
  type SpeechSettings,
} from '@/utils/storage'

type SpeakTextOptions = {
  lang?: string
}

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null

export async function speakText(text: string, options: SpeakTextOptions = {}) {
  const normalizedText = text.trim()
  if (!normalizedText) return

  try {
    const settings = normalizeSpeechSettings(await speechSettings.getValue())
    if (settings.provider === 'edge') {
      try {
        await speakWithEdge(normalizedText, settings)
        return
      } catch (error) {
        console.warn('Edge TTS failed:', error)
        if (!settings.fallbackToBrowser) return
      }
    }

    await speakWithBrowser(normalizedText, settings, options)
  } catch (error) {
    console.warn('Speech playback failed:', error)
  }
}

function speakWithBrowser(text: string, settings: SpeechSettings, options: SpeakTextOptions) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    throw new Error('Browser speech synthesis is not available')
  }

  stopCurrentSpeech()
  const utterance = new SpeechSynthesisUtterance(text)
  if (options.lang) utterance.lang = options.lang
  utterance.rate = settings.rate
  utterance.pitch = settings.pitch
  utterance.volume = settings.volume
  window.speechSynthesis.cancel()
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }

    utterance.onend = () => settle(resolve)
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        settle(resolve)
        return
      }
      settle(() => reject(new Error(`Browser speech synthesis failed: ${event.error}`)))
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      settle(() => reject(error))
    }
  })
}

async function speakWithEdge(text: string, settings: SpeechSettings) {
  stopCurrentSpeech()
  await sendMessage('edgeTtsSpeak', {
    text,
    voice: settings.edgeVoice,
    rate: settings.rate,
    pitch: settings.pitch,
    volume: settings.volume,
  })
}

function stopCurrentSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

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

import { DEFAULT_EDGE_TTS_VOICE, getEdgeTtsVoiceLocale } from '@/utils/storage'

export type EdgeTtsSynthesizeInput = {
  text: string
  voice: string
  rate: number
  pitch: number
  volume: number
}

export type EdgeTtsSynthesizeResult = {
  audioBase64: string
  contentType: string
}

const EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const EDGE_TTS_ENDPOINT = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const EDGE_TTS_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const EDGE_TTS_TIMEOUT_MS = 20_000
const EDGE_CHROMIUM_FULL_VERSION = '143.0.3650.75'
const SEC_MS_GEC_VERSION = `1-${EDGE_CHROMIUM_FULL_VERSION}`
const WINDOWS_EPOCH_SECONDS = 11_644_473_600n
const SEC_MS_GEC_WINDOW_SECONDS = 300n
const TICKS_PER_SECOND = 10_000_000n

export async function synthesizeEdgeTts(input: EdgeTtsSynthesizeInput): Promise<EdgeTtsSynthesizeResult> {
  const text = input.text.trim()
  if (!text) throw new Error('Speech text is empty')

  const audioBytes = await requestEdgeAudio({
    text,
    voice: input.voice || DEFAULT_EDGE_TTS_VOICE,
    rate: input.rate,
    pitch: input.pitch,
    volume: input.volume,
  })

  return {
    audioBase64: uint8ArrayToBase64(audioBytes),
    contentType: 'audio/mpeg',
  }
}

async function requestEdgeAudio(input: Required<EdgeTtsSynthesizeInput>): Promise<Uint8Array> {
  const url = await createEdgeTtsUrl()

  return new Promise((resolve, reject) => {
    const requestId = createRequestId()
    const socket = new WebSocket(`${url}&ConnectionId=${requestId}`)
    socket.binaryType = 'arraybuffer'

    const chunks: Uint8Array[] = []
    let settled = false
    const timeoutId = setTimeout(() => {
      fail(new Error('Edge TTS request timed out'))
    }, EDGE_TTS_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timeoutId)
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
    }

    function fail(error: Error) {
      if (settled) return
      settled = true
      cleanup()
      try {
        socket.close()
      } catch {
        // no-op
      }
      reject(error)
    }

    function complete() {
      if (settled) return
      const audio = concatUint8Arrays(chunks)
      if (audio.length === 0) {
        fail(new Error(`Edge TTS returned empty audio for ${input.voice} (${getEdgeTtsVoiceLocale(input.voice)})`))
        return
      }
      settled = true
      cleanup()
      try {
        socket.close()
      } catch {
        // no-op
      }
      resolve(audio)
    }

    socket.onopen = () => {
      socket.send(buildSpeechConfigMessage())
      socket.send(buildSsmlMessage(requestId, input))
    }

    socket.onerror = () => {
      fail(new Error('Edge TTS connection failed'))
    }

    socket.onclose = () => {
      if (!settled) fail(new Error('Edge TTS connection closed before completion'))
    }

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) complete()
        if (event.data.includes('Path:audio')) {
          const audio = parseTextAudioMessage(event.data)
          if (audio?.length) chunks.push(audio)
        }
        return
      }

      const audio = parseAudioMessage(event.data)
      if (audio?.length) chunks.push(audio)
    }
  })
}

async function createEdgeTtsUrl() {
  const secMsGec = await generateSecMsGec()
  const params = new URLSearchParams({
    TrustedClientToken: EDGE_TTS_TOKEN,
    'Sec-MS-GEC': secMsGec,
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
  })
  return `${EDGE_TTS_ENDPOINT}?${params.toString()}`
}

async function generateSecMsGec() {
  const unixSeconds = BigInt(Math.floor(Date.now() / 1000))
  const roundedSeconds = unixSeconds - (unixSeconds % SEC_MS_GEC_WINDOW_SECONDS)
  const windowsTicks = (roundedSeconds + WINDOWS_EPOCH_SECONDS) * TICKS_PER_SECOND
  const hashInput = `${windowsTicks}${EDGE_TTS_TOKEN}`
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput))
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function buildSpeechConfigMessage() {
  return [
    'X-Timestamp:' + new Date().toISOString(),
    'Content-Type:application/json; charset=utf-8',
    'Path:speech.config',
    '',
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: false,
              wordBoundaryEnabled: false,
            },
            outputFormat: EDGE_TTS_OUTPUT_FORMAT,
          },
        },
      },
    }),
  ].join('\r\n')
}

function buildSsmlMessage(requestId: string, input: Required<EdgeTtsSynthesizeInput>) {
  return [
    `X-RequestId:${requestId}`,
    'Content-Type:application/ssml+xml',
    'X-Timestamp:' + new Date().toUTCString(),
    'Path:ssml',
    '',
    buildSsml(input),
  ].join('\r\n')
}

function buildSsml(input: Required<EdgeTtsSynthesizeInput>) {
  const locale = getEdgeTtsVoiceLocale(input.voice)
  return [
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${escapeXml(locale)}">`,
    `<voice name="${escapeXml(input.voice)}">`,
    `<prosody rate="${formatRate(input.rate)}" pitch="${formatPitch(input.pitch)}" volume="${formatVolume(input.volume)}">`,
    escapeXml(input.text),
    '</prosody>',
    '</voice>',
    '</speak>',
  ].join('')
}

function parseAudioMessage(data: ArrayBuffer | Blob) {
  if (data instanceof Blob) return null

  const bytes = new Uint8Array(data)
  if (bytes.length < 2) return null

  const headerLength = (bytes[0] << 8) + bytes[1]
  const audioOffset = 2 + headerLength
  if (audioOffset >= bytes.length) return null

  return bytes.slice(audioOffset)
}

function parseTextAudioMessage(data: string) {
  const audioStart = data.indexOf('\r\n\r\n')
  if (audioStart < 0) return null
  const headerBlock = data.slice(0, audioStart)
  if (!headerBlock.includes('Path:audio')) return null
  const audioString = data.slice(audioStart + 4)
  if (!audioString) return null
  const bytes = new Uint8Array(audioString.length)
  for (let i = 0; i < audioString.length; i += 1) {
    bytes[i] = audioString.charCodeAt(i) & 0xff
  }
  return bytes
}

function concatUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = ''
  const batchSize = 0x8000
  for (let i = 0; i < bytes.length; i += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + batchSize))
  }
  return btoa(binary)
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '')
  }
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function formatRate(rate: number) {
  const percent = Math.round((clamp(rate, 0.5, 2) - 1) * 100)
  return percent >= 0 ? `+${percent}%` : `${percent}%`
}

function formatPitch(pitch: number) {
  const hertz = Math.round((clamp(pitch, 0.5, 2) - 1) * 100)
  return hertz >= 0 ? `+${hertz}Hz` : `${hertz}Hz`
}

function formatVolume(volume: number) {
  return `${Math.round((clamp(volume, 0, 1) - 1) * 100)}%`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

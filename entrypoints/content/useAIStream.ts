import { useCallback, useEffect, useRef, useState } from 'react'
import type { VocabResponse } from '@/lib/aiSchema'

export type AIStreamStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

export interface UseAIStreamResult {
  partial: Partial<VocabResponse>
  final: VocabResponse | null
  status: AIStreamStatus
  error: string | null
  hasReceivedChunk: boolean
  start: (text: string, sourceContext?: string) => void
  retry: () => void
  abort: () => void
}

/**
 * Wraps the Chrome runtime Port lifecycle for structured AI streaming.
 *
 * The background script accepts `{ type: 'start', text, sourceContext }`
 * and responds with `partial` / `complete` / `error` messages.
 */
export function useAIStream(): UseAIStreamResult {
  const [partial, setPartial] = useState<Partial<VocabResponse>>({})
  const [final, setFinal] = useState<VocabResponse | null>(null)
  const [status, setStatus] = useState<AIStreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasReceivedChunk, setHasReceivedChunk] = useState(false)

  const portRef = useRef<chrome.runtime.Port | null>(null)
  const lastRequestRef = useRef<{ text: string; sourceContext?: string } | null>(null)

  const cleanup = useCallback(() => {
    try {
      portRef.current?.disconnect()
    } catch {
      // ignore
    }
    portRef.current = null
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const start = useCallback((text: string, sourceContext?: string) => {
    cleanup()
    setPartial({})
    setFinal(null)
    setError(null)
    setStatus('loading')
    setHasReceivedChunk(false)
    lastRequestRef.current = { text, sourceContext }

    try {
      const port = chrome.runtime.connect({ name: 'ai-stream' })
      portRef.current = port
      let settled = false

      port.onMessage.addListener((msg) => {
        if (msg.type === 'partial' && msg.partial) {
          setStatus('streaming')
          setPartial(msg.partial)
        } else if (msg.type === 'chunk' && msg.chunk) {
          setHasReceivedChunk(true)
          setStatus('streaming')
        } else if (msg.type === 'complete' && msg.value) {
          settled = true
          setFinal(msg.value)
          setPartial(msg.value)
          setStatus('success')
          cleanup()
        } else if (msg.type === 'error') {
          settled = true
          console.error('AI stream error:', msg.error)
          setError(normalizeError(msg.error))
          setStatus('error')
          cleanup()
        }
      })

      port.onDisconnect.addListener(() => {
        if (!settled) {
          setError('The AI connection closed before returning a response.')
          setStatus('error')
        }
        if (portRef.current === port) portRef.current = null
      })

      port.postMessage({ type: 'start', text, sourceContext })
    } catch (e) {
      console.error('Failed to start AI stream:', e)
      setError(normalizeError(e))
      setStatus('error')
    }
  }, [cleanup])

  const retry = useCallback(() => {
    if (!lastRequestRef.current) return
    start(lastRequestRef.current.text, lastRequestRef.current.sourceContext)
  }, [start])

  const abort = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  return { partial, final, status, error, hasReceivedChunk, start, retry, abort }
}

function normalizeError(value: unknown) {
  if (value instanceof Error) return value.message
  const message = String(value || '').trim()
  if (!message) return 'The AI provider did not return a usable response.'
  return message
}

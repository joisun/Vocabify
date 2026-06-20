import { useCallback, useEffect, useRef, useState } from 'react'
import type { VocabResponse } from '@/lib/aiSchema'

export type AIStreamStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

export interface UseAIStreamResult {
  partial: Partial<VocabResponse>
  final: VocabResponse | null
  status: AIStreamStatus
  error: string | null
  retryInfo: { attempt: number; maxRetries: number; error: string } | null
  hasReceivedChunk: boolean
  hasReceivedReasoning: boolean
  start: (text: string, sourceContext?: string) => void
  retry: () => void
  abort: () => void
}

interface AIStreamCallbacks {
  onChunk?: (chunk: string) => void
  onReasoning?: (chunk: string) => void
  onPartial?: (partial: Partial<VocabResponse>) => void
  onComplete?: (value: VocabResponse) => void
  onRetry?: (attempt: number, maxRetries: number, error: string) => void
  onError?: (error: Error) => void
}

interface AIStreamConnection {
  abort: () => void
}

export function openAIStream(
  text: string,
  sourceContext: string | undefined,
  callbacks: AIStreamCallbacks,
): AIStreamConnection {
  let settled = false
  let port: chrome.runtime.Port | null = null

  const disconnect = () => {
    try {
      port?.disconnect()
    } catch {
      // ignore disconnect races
    }
    port = null
  }

  const settle = (callback?: () => void) => {
    if (settled) return
    settled = true
    callback?.()
    disconnect()
  }

  try {
    port = chrome.runtime.connect({ name: 'ai-stream' })

    port.onMessage.addListener((msg) => {
      if (msg.type === 'partial' && msg.partial) {
        callbacks.onPartial?.(msg.partial as Partial<VocabResponse>)
        return
      }
      if (msg.type === 'chunk' && msg.chunk) {
        callbacks.onChunk?.(String(msg.chunk))
        return
      }
      if (msg.type === 'reasoning' && msg.chunk) {
        callbacks.onReasoning?.(String(msg.chunk))
        return
      }
      if (msg.type === 'retry') {
        callbacks.onRetry?.(
          Number(msg.attempt) || 0,
          Number(msg.maxRetries) || 0,
          normalizeError(msg.error),
        )
        return
      }
      if (msg.type === 'complete' && msg.value) {
        settle(() => callbacks.onComplete?.(msg.value as VocabResponse))
        return
      }
      if (msg.type === 'error') {
        settle(() => callbacks.onError?.(new Error(normalizeError(msg.error))))
      }
    })

    port.onDisconnect.addListener(() => {
      if (!settled) {
        settled = true
        callbacks.onError?.(new Error('The AI connection closed before returning a response.'))
      }
      port = null
    })

    port.postMessage({ type: 'start', text, sourceContext })
  } catch (error) {
    settle(() => callbacks.onError?.(error instanceof Error ? error : new Error(normalizeError(error))))
  }

  return {
    abort: () => settle(),
  }
}

export function requestAICompletion(text: string, sourceContext?: string): Promise<VocabResponse> {
  return new Promise((resolve, reject) => {
    openAIStream(text, sourceContext, {
      onComplete: resolve,
      onError: reject,
    })
  })
}

export function useAIStream(): UseAIStreamResult {
  const [partial, setPartial] = useState<Partial<VocabResponse>>({})
  const [final, setFinal] = useState<VocabResponse | null>(null)
  const [status, setStatus] = useState<AIStreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; maxRetries: number; error: string } | null>(null)
  const [hasReceivedChunk, setHasReceivedChunk] = useState(false)
  const [hasReceivedReasoning, setHasReceivedReasoning] = useState(false)

  const connectionRef = useRef<AIStreamConnection | null>(null)
  const lastRequestRef = useRef<{ text: string; sourceContext?: string } | null>(null)

  const cleanup = useCallback(() => {
    connectionRef.current?.abort()
    connectionRef.current = null
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const start = useCallback((text: string, sourceContext?: string) => {
    cleanup()
    setPartial({})
    setFinal(null)
    setError(null)
    setRetryInfo(null)
    setStatus('loading')
    setHasReceivedChunk(false)
    setHasReceivedReasoning(false)
    lastRequestRef.current = { text, sourceContext }

    connectionRef.current = openAIStream(text, sourceContext, {
      onPartial: (nextPartial) => {
        setStatus('streaming')
        setPartial(nextPartial)
      },
      onChunk: () => {
        setHasReceivedChunk(true)
        setStatus('streaming')
      },
      onReasoning: (chunk) => {
        if (chunk) setHasReceivedReasoning(true)
        setStatus('streaming')
      },
      onRetry: (attempt, maxRetries, retryError) => {
        setPartial({})
        setFinal(null)
        setHasReceivedChunk(false)
        setHasReceivedReasoning(false)
        setRetryInfo({ attempt, maxRetries, error: retryError })
        setStatus('loading')
      },
      onComplete: (value) => {
        setFinal(value)
        setPartial(value)
        setRetryInfo(null)
        setStatus('success')
        connectionRef.current = null
      },
      onError: (streamError) => {
        console.error('AI stream error:', streamError)
        setError(normalizeError(streamError))
        setRetryInfo(null)
        setStatus('error')
        connectionRef.current = null
      },
    })
  }, [cleanup])

  const retry = useCallback(() => {
    if (!lastRequestRef.current) return
    start(lastRequestRef.current.text, lastRequestRef.current.sourceContext)
  }, [start])

  const abort = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  return {
    partial,
    final,
    status,
    error,
    retryInfo,
    hasReceivedChunk,
    hasReceivedReasoning,
    start,
    retry,
    abort,
  }
}

function normalizeError(value: unknown) {
  if (value instanceof Error) return value.message
  const message = String(value || '').trim()
  return message || 'The AI provider did not return a usable response.'
}

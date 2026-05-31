import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveRecord } from '@/lib/vocabifyDb'
import { MeshGradient } from '@paper-design/shaders-react'
import { AlertCircle, Check, Copy, Edit3, Save, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AIExplanationProps {
  selectedText: string
}

type StreamStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

export function AIExplanation({ selectedText }: AIExplanationProps) {
  const [explanation, setExplanation] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const requestRef = useRef(0)
  const resultScrollRef = useRef<HTMLDivElement | null>(null)
  const userScrolledRef = useRef(false)

  useEffect(() => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    startAIStream(requestId)

    return () => {
      portRef.current?.disconnect()
      portRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedText])

  function startAIStream(requestId = requestRef.current + 1) {
    requestRef.current = requestId
    portRef.current?.disconnect()
    portRef.current = null
    setStatus('loading')
    setError(null)
    setExplanation('')
    setSavedKey(null)
    setEditing(false)
    userScrolledRef.current = false

    try {
      const port = chrome.runtime.connect({ name: 'ai-stream' })
      portRef.current = port
      let settled = false

      port.onMessage.addListener((msg) => {
        if (requestRef.current !== requestId) return

        if (msg.type === 'chunk') {
          setStatus('streaming')
          setExplanation((prev) => prev + msg.chunk)
        } else if (msg.type === 'complete') {
          settled = true
          setStatus('success')
          port.disconnect()
          if (portRef.current === port) portRef.current = null
        } else if (msg.type === 'error') {
          settled = true
          console.error('AI stream error:', msg.error)
          setError(normalizeError(msg.error))
          setStatus('error')
          port.disconnect()
          if (portRef.current === port) portRef.current = null
        }
      })

      port.onDisconnect.addListener(() => {
        if (!settled && requestRef.current === requestId) {
          setError('The AI connection closed before returning a response. Check the provider key, model access, or background service worker logs.')
          setStatus('error')
        }
        if (portRef.current === port) portRef.current = null
      })

      port.postMessage({ type: 'start', text: selectedText })
    } catch (streamError) {
      console.error('Failed to start AI stream:', streamError)
      setError(normalizeError(streamError))
      setStatus('error')
    }
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const result = await saveRecord(selectedText, explanation)
      setSavedKey(selectedText)
      toast.success(result.title, {
        description: result.detail,
      })
    } catch (saveError) {
      console.error('Save failed:', saveError)
      toast.error('Save failed', {
        description: 'The explanation could not be written to your vocabulary list.',
      })
    } finally {
      setSaving(false)
    }
  }

  function speak() {
    try {
      const utterance = new SpeechSynthesisUtterance(selectedText)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch (ttsError) {
      console.error('TTS failed:', ttsError)
    }
  }

  function copyResult() {
    const text = explanation.trim() || selectedText
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Copy failed'),
    )
  }

  const isSaved = savedKey === selectedText
  const isLoading = status === 'loading' || status === 'streaming'
  const canSave = status === 'success' && explanation.trim() && !isSaved

  useEffect(() => {
    if (editing) return
    if (!explanation || userScrolledRef.current) return
    const scrollNode = resultScrollRef.current
    if (!scrollNode) return
    scrollNode.scrollTop = scrollNode.scrollHeight
  }, [editing, explanation])

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3" data-testid="vocabify-ai-panel">
      <section
        className="liquid-card relative overflow-hidden rounded-2xl p-3 text-card-foreground shadow-[0_10px_28px_hsl(var(--shadow-color)/0.08)]"
        aria-label="Selected text"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              Selection
            </p>
            <p className="mt-1 font-display text-[14px] leading-snug font-semibold tracking-tight text-foreground break-words">
              {selectedText}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyResult}
              aria-label="Copy selection or explanation"
              title="Copy"
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={speak}
              aria-label="Pronounce selection"
              title="Pronounce"
              className="text-muted-foreground hover:text-primary"
            >
              <Volume2 />
            </Button>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="liquid-glass-card relative min-h-0 flex-1 overflow-hidden rounded-2xl">
          {status === 'loading' ? (
            <LoadingState />
          ) : status === 'error' ? (
            <ErrorState error={error} />
          ) : editing ? (
            <Textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="AI explanation will appear here..."
              className="h-full resize-none rounded-none border-0 bg-transparent p-4 shadow-none focus-visible:ring-0 scrollbar-thin"
              aria-label="Edit AI explanation"
            />
          ) : explanation.trim() ? (
            <MarkdownResult
              text={explanation}
              streaming={status === 'streaming'}
              scrollRef={resultScrollRef}
              userScrolledRef={userScrolledRef}
            />
          ) : (
            <EmptyResult />
          )}
        </div>
      </section>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          size="lg"
          className={cn(
            'liquid-glass-button rounded-xl text-[14px] text-black hover:text-black dark:text-black',
            isSaved && 'text-black'
          )}
          data-testid="vocabify-save-action"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
              Saving
            </>
          ) : isSaved ? (
            <>
              <Check data-icon="inline-start" />
              Saved
            </>
          ) : (
            <>
              <Save data-icon="inline-start" />
              Save
            </>
          )}
        </Button>

        <MeshRetryButton onRetry={() => startAIStream()} loading={isLoading} />

        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          onClick={() => setEditing((value) => !value)}
          disabled={!explanation.trim()}
          aria-label={editing ? 'Preview explanation' : 'Edit explanation'}
          title={editing ? 'Preview' : 'Edit'}
        >
          <Edit3 />
        </Button>
      </div>
    </div>
  )
}

function normalizeError(value: unknown) {
  if (value instanceof Error) return value.message
  const message = String(value || '').trim()
  if (!message) return 'The AI provider did not return a usable response.'
  return message
}

function MeshRetryButton({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      className="group relative h-11 w-11 appearance-none overflow-visible rounded-xl border-0 bg-transparent p-0 outline-none transition duration-200 hover:scale-[1.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
      onClick={onRetry}
      aria-label="Retry explanation"
      title="Retry"
      data-testid="vocabify-retry-mesh-action"
    >
      <span className="absolute inset-1 overflow-visible opacity-85 transition-opacity group-hover:opacity-100">
        <ShaderBlob compact loading={loading} />
      </span>
    </button>
  )
}

const LoadingState = () => (
  <div className="flex h-full min-h-0 flex-col justify-center gap-4 px-5 py-5" data-testid="vocabify-ai-loading">
    <div className="space-y-3">
      <div className="vocabify-skeleton-breathe h-5 w-28 rounded-full" />
      <div className="space-y-2.5">
        <div className="vocabify-skeleton-breathe h-3.5 w-full rounded-full [animation-delay:.08s]" />
        <div className="vocabify-skeleton-breathe h-3.5 w-[92%] rounded-full [animation-delay:.16s]" />
        <div className="vocabify-skeleton-breathe h-3.5 w-[74%] rounded-full [animation-delay:.24s]" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="vocabify-skeleton-breathe h-4 w-20 rounded-full [animation-delay:.32s]" />
      <div className="grid gap-2">
        <div className="vocabify-skeleton-breathe h-3.5 w-[86%] rounded-full [animation-delay:.4s]" />
        <div className="vocabify-skeleton-breathe h-3.5 w-[64%] rounded-full [animation-delay:.48s]" />
      </div>
    </div>
    <p className="text-[10px] font-medium text-muted-foreground">
      Generating explanation. Click the mesh control to retry.
    </p>
  </div>
)

function ShaderBlob({ compact = false, loading = false }: { compact?: boolean; loading?: boolean }) {
  const clipId = React.useId()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const colors = ['#FFB3D9', '#87CEEB', '#4A90E2', '#2C3E50', '#1A1A2E']

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const rect = hostRef.current?.getBoundingClientRect()
      if (!rect) return
      const deltaX = (event.clientX - (rect.left + rect.width / 2)) * 0.08
      const deltaY = (event.clientY - (rect.top + rect.height / 2)) * 0.08
      const maxOffset = compact ? 5 : 8
      setEyeOffset({
        x: Math.max(-maxOffset, Math.min(maxOffset, deltaX)),
        y: Math.max(-maxOffset, Math.min(maxOffset, deltaY)),
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [compact])

  return (
    <div
      ref={hostRef}
      className={cn(
        'vocabify-shader-blob h-full w-full text-foreground/80',
        loading && 'is-fast',
        compact && 'is-compact'
      )}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="231"
        height="289"
        viewBox="0 0 231 289"
        className="mx-auto h-full w-auto"
      >
        <defs>
          <clipPath id={clipId}>
            <path d="M230.809 115.385V249.411C230.809 269.923 214.985 287.282 194.495 288.411C184.544 288.949 175.364 285.718 168.26 280C159.746 273.154 147.769 273.461 139.178 280.23C132.638 285.384 124.381 288.462 115.379 288.462C106.377 288.462 98.1451 285.384 91.6055 280.23C82.912 273.385 70.9353 273.385 62.2415 280.23C55.7532 285.334 47.598 288.411 38.7246 288.462C17.4132 288.615 0 270.667 0 249.359V115.385C0 51.6667 51.6756 0 115.404 0C179.134 0 230.809 51.6667 230.809 115.385Z" />
          </clipPath>
        </defs>

        <foreignObject width="231" height="289" clipPath={`url(#${clipId})`}>
          <div className="h-full w-full">
            <MeshGradient
              colors={colors}
              className="h-full w-full"
              speed={loading ? 1.65 : 0.75}
              distortion={compact ? 0.78 : 0.9}
              swirl={compact ? 0.32 : 0.45}
            />
          </div>
        </foreignObject>

        <g
          className="vocabify-shader-eye-track"
          style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}
        >
          {loading ? (
            <>
              <path className="vocabify-shader-star-eye" d="M80 91L87.3 112.7L110 120L87.3 127.3L80 149L72.7 127.3L50 120L72.7 112.7Z" fill="currentColor" />
              <path className="vocabify-shader-star-eye [animation-delay:.18s]" d="M150 91L157.3 112.7L180 120L157.3 127.3L150 149L142.7 127.3L120 120L142.7 112.7Z" fill="currentColor" />
            </>
          ) : (
            <>
              <ellipse cx="80" cy="120" rx="20" ry="30" fill="currentColor" className="vocabify-shader-eye" />
              <ellipse cx="150" cy="120" rx="20" ry="30" fill="currentColor" className="vocabify-shader-eye" />
            </>
          )}
        </g>
      </svg>
    </div>
  )
}

function ErrorState({ error }: { error: string | null }) {
  const detail = error || 'Check your provider key, model access, or network connection.'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="vocabify-ai-error">
      <div className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pr-5">
        <div className="flex items-start gap-3 text-destructive">
          <AlertCircle className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display text-[14px] font-semibold tracking-tight">AI explanation failed</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-destructive/75">
              Retry with the mesh control below, or adjust your provider settings.
            </p>
          </div>
        </div>
        <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-destructive/20 bg-destructive/10 p-3 font-mono text-[11px] leading-relaxed text-destructive/85 shadow-apple-xs">{detail}</pre>
      </div>
    </div>
  )
}

const EmptyResult = () => (
  <div className="flex h-full items-center justify-center p-6 text-center text-[12px] leading-relaxed text-muted-foreground">
    Select a word or phrase and Vocabify will generate an explanation here.
  </div>
)

function MarkdownResult({
  text,
  streaming,
  scrollRef,
  userScrolledRef,
}: {
  text: string
  streaming: boolean
  scrollRef: React.MutableRefObject<HTMLDivElement | null>
  userScrolledRef: React.MutableRefObject<boolean>
}) {
  const blocks = parseMarkdownBlocks(text)

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden"
      data-testid="vocabify-ai-result"
      onWheelCapture={(event) => {
        const scrollNode = scrollRef.current
        if (!scrollNode) return
        if (scrollNode.scrollHeight <= scrollNode.clientHeight) return
        event.preventDefault()
        userScrolledRef.current = true
        scrollNode.scrollTop += event.deltaY
        event.stopPropagation()
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-[linear-gradient(to_bottom,hsl(var(--card)/0.42),hsl(var(--card)/0))]"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-[linear-gradient(to_top,hsl(var(--card)/0.42),hsl(var(--card)/0))]"
        aria-hidden
      />
      <div
        ref={scrollRef}
        className="vocabify-fade-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-scroll overscroll-contain px-4 py-4 pr-5"
        data-testid="vocabify-ai-result-scroll"
      >
        <div className="flex min-h-full w-full min-w-0 flex-col gap-3 text-[12px] leading-relaxed text-foreground">
          {blocks.map((block, index) => {
            if (block.type === 'heading') {
              return (
                <h3 key={index} className="font-display text-[14px] font-semibold tracking-tight text-foreground">
                  {block.text}
                </h3>
              )
            }

            if (block.type === 'list') {
              return (
                <ul key={index} className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-primary">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )
            }

            return (
              <p key={index} className="min-w-0 break-words text-muted-foreground">
                {block.text}
              </p>
            )
          })}
          {streaming ? <span className="inline-block h-4 w-1.5 rounded-full bg-primary animate-ai-pulse" aria-hidden /> : null}
        </div>
      </div>
    </div>
  )
}

type MarkdownBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = text.split('\n')
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'list', items: listItems })
      listItems = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }

    if (line.startsWith('#')) {
      flushList()
      blocks.push({ type: 'heading', text: line.replace(/^#+\s*/, '') })
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''))
      continue
    }

    flushList()
    blocks.push({ type: 'paragraph', text: line.replace(/\*\*/g, '') })
  }

  flushList()
  return blocks
}

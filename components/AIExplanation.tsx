import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveRecord } from '@/lib/vocabifyDb'
import { MeshGradient } from '@paper-design/shaders-react'
import { AlertCircle, Check, Copy, Edit3, RotateCcw, Save, Volume2 } from 'lucide-react'
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
  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="vocabify-ai-panel">
      <section
        className="liquid-card relative overflow-hidden rounded-2xl p-3 text-card-foreground shadow-[0_10px_28px_hsl(var(--shadow-color)/0.08)]"
        aria-label="Selected text"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Selection
            </p>
            <p className="mt-1 font-display text-[16px] leading-snug font-semibold tracking-tight text-foreground break-words">
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
        {isLoading ? <StreamingIndicator /> : null}
        <div className="liquid-card relative min-h-0 flex-1 overflow-hidden rounded-2xl shadow-[0_10px_28px_hsl(var(--shadow-color)/0.08)]">
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
            <MarkdownResult text={explanation} streaming={status === 'streaming'} />
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
            'rounded-xl border border-white/[0.16] bg-[linear-gradient(180deg,hsl(var(--primary)/0.98),hsl(var(--primary)/0.84))] shadow-[0_12px_30px_hsl(var(--primary)/0.24)] backdrop-blur-xl',
            isSaved && 'bg-success text-white hover:bg-success/90'
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

        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          onClick={() => startAIStream()}
          disabled={isLoading}
          aria-label="Retry explanation"
          title="Retry"
        >
          <RotateCcw />
        </Button>

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
  if (message.length > 260) return `${message.slice(0, 260)}...`
  return message
}

const StreamingIndicator = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/[0.34] px-2 py-1 text-[11px] font-medium text-accent-foreground shadow-apple-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.10]" aria-label="AI is responding">
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-ai-pulse" />
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-ai-pulse [animation-delay:.15s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-ai-pulse [animation-delay:.3s]" />
  </span>
)

const LoadingState = () => (
  <div className="flex h-full min-h-0 items-center justify-center p-4" data-testid="vocabify-ai-loading">
    <div className="relative flex w-full max-w-[280px] flex-col items-center gap-4 rounded-[24px] border border-white/20 bg-white/[0.18] px-5 py-5 text-center shadow-[0_14px_40px_hsl(var(--shadow-color)/0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
      <div className="relative flex h-[148px] w-[148px] items-center justify-center overflow-hidden rounded-[38px] border border-white/20 bg-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_30px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="absolute inset-0 opacity-90">
          <ShaderBlob />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,hsl(var(--background)/0.18)_78%,hsl(var(--background)/0.42)_100%)]" />
      </div>
      <div className="space-y-1">
        <p className="text-[13px] font-semibold tracking-tight text-foreground">Generating explanation</p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Reading the selection and preparing a concise answer.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ai-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ai-pulse [animation-delay:.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ai-pulse [animation-delay:.3s]" />
        <span>Shader render in progress</span>
      </div>
    </div>
  </div>
)

const ShaderBlob = () => {
  const clipId = React.useId()
  const colors = ['#FFB3D9', '#87CEEB', '#4A90E2', '#2C3E50', '#1A1A2E']

  return (
    <div className="vocabify-shader-blob h-full w-full text-foreground/80" aria-hidden>
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
            <MeshGradient colors={colors} className="h-full w-full" speed={0.75} distortion={0.9} swirl={0.45} />
          </div>
        </foreignObject>

        <ellipse cx="80" cy="120" rx="20" ry="30" fill="currentColor" className="vocabify-shader-eye" />
        <ellipse cx="150" cy="120" rx="20" ry="30" fill="currentColor" className="vocabify-shader-eye" />
      </svg>
    </div>
  )
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="flex h-full flex-col justify-center p-4" data-testid="vocabify-ai-error">
      <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-destructive shadow-apple-xs backdrop-blur-lg">
        <AlertCircle className="mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold">AI explanation failed</p>
          <p className="mt-1 text-[12px] leading-relaxed text-destructive/85">
            {error || 'Check your provider key, model access, or network connection.'}
          </p>
        </div>
      </div>
    </div>
  )
}

const EmptyResult = () => (
  <div className="flex h-full items-center justify-center p-6 text-center text-[13px] leading-relaxed text-muted-foreground">
    Select a word or phrase and Vocabify will generate an explanation here.
  </div>
)

function MarkdownResult({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks = parseMarkdownBlocks(text)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="vocabify-ai-result"
      onWheelCapture={(event) => {
        const scrollNode = scrollRef.current
        if (!scrollNode) return
        if (scrollNode.scrollHeight <= scrollNode.clientHeight) return
        scrollNode.scrollTop += event.deltaY
        event.stopPropagation()
      }}
    >
      <div
        ref={scrollRef}
        className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pr-5"
        data-testid="vocabify-ai-result-scroll"
      >
        <div className="flex min-h-full flex-col gap-3 text-[13px] leading-relaxed text-foreground">
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
              <p key={index} className="text-muted-foreground">
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

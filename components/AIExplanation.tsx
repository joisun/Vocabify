import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveRecord } from '@/lib/vocabifyDb'
import { AlertCircle, Check, Copy, Edit3, RotateCcw, Save, Settings, Volume2 } from 'lucide-react'
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

  function openSettings() {
    chrome.runtime.openOptionsPage?.()
  }

  const isSaved = savedKey === selectedText
  const isLoading = status === 'loading' || status === 'streaming'
  const canSave = status === 'success' && explanation.trim() && !isSaved
  const statusLabel = useMemo(() => {
    if (status === 'loading') return 'Contacting AI provider'
    if (status === 'streaming') return 'Streaming explanation'
    if (status === 'success') return 'Ready to save'
    if (status === 'error') return 'Needs attention'
    return 'Waiting'
  }, [status])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4" data-testid="vocabify-ai-panel">
      <section
        className="liquid-card relative overflow-hidden rounded-2xl p-4 text-card-foreground shadow-[0_10px_28px_hsl(var(--shadow-color)/0.08)]"
        aria-label="Selected text"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Selection
            </p>
            <p className="mt-1 font-display text-[17px] leading-snug font-semibold tracking-tight text-foreground break-words">
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

      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              AI Explanation
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground" aria-live="polite">
              {statusLabel}
            </p>
          </div>
          {isLoading ? <StreamingIndicator /> : null}
        </header>

        <div className="liquid-card relative min-h-0 flex-1 overflow-hidden rounded-2xl shadow-[0_10px_28px_hsl(var(--shadow-color)/0.08)]">
          {status === 'loading' ? (
            <LoadingState />
          ) : status === 'error' ? (
            <ErrorState error={error} onRetry={() => startAIStream()} onOpenSettings={openSettings} />
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
  <div className="flex h-full flex-col gap-4 p-4" data-testid="vocabify-ai-loading">
    <div className="rounded-xl border border-white/[0.24] bg-white/[0.28] p-3 shadow-apple-xs backdrop-blur-lg dark:border-white/10 dark:bg-white/[0.08]">
      <p className="text-[13px] font-medium text-foreground">Generating a concise vocabulary explanation</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Vocabify is reading the selection, applying your target language, and contacting the first available AI provider.
      </p>
    </div>
    <div className="flex flex-col gap-2">
      <div className="h-3 w-3/4 rounded-md bg-secondary animate-ai-pulse" />
      <div className="h-3 w-full rounded-md bg-secondary animate-ai-pulse" />
      <div className="h-3 w-5/6 rounded-md bg-secondary animate-ai-pulse" />
      <div className="h-3 w-2/3 rounded-md bg-secondary animate-ai-pulse" />
    </div>
  </div>
)

function ErrorState({ error, onRetry, onOpenSettings }: { error: string | null; onRetry: () => void; onOpenSettings: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 p-4" data-testid="vocabify-ai-error">
      <div>
        <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-destructive shadow-apple-xs backdrop-blur-lg">
          <AlertCircle className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">AI explanation failed</p>
            <p className="mt-1 text-[12px] leading-relaxed text-destructive/85">
              {error || 'Check your provider key, model access, or network connection.'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          The failed response is not saved. Retry after checking the API key or provider order in settings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onOpenSettings}>
          <Settings data-icon="inline-start" />
          Settings
        </Button>
        <Button onClick={onRetry}>
          <RotateCcw data-icon="inline-start" />
          Retry
        </Button>
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

  return (
    <div className="h-full min-h-0 overflow-hidden" data-testid="vocabify-ai-result">
      <div
        className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-4 pr-5 scrollbar-thin [scrollbar-gutter:stable]"
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

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveRecord } from '@/lib/vocabifyDb'
import { AlertCircle, Check, Copy, Edit3, RefreshCw, Save, Volume2 } from 'lucide-react'
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
      toast.success(result.title, { description: result.detail })
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
      {/* Selection header */}
      <section className="flex items-start justify-between gap-2" aria-label="Selected text">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Selection</p>
          <p className="mt-0.5 break-words font-display text-[15px] font-semibold leading-snug text-foreground">
            {selectedText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={copyResult} aria-label="Copy" title="Copy" className="text-muted-foreground hover:text-foreground">
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={speak} aria-label="Pronounce" title="Pronounce" className="text-muted-foreground hover:text-foreground">
            <Volume2 />
          </Button>
        </div>
      </section>

      {/* Result */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card dark:border-white/8">
        {status === 'loading' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <ErrorState error={error} />
        ) : editing ? (
          <Textarea
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            placeholder="AI explanation will appear here..."
            className="h-full resize-none rounded-[10px] border-0 bg-transparent p-3.5 text-[13px] focus-visible:ring-0 scrollbar-thin"
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
      </section>

      {/* Actions */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          size="default"
          variant="default"
          className="rounded-[8px]"
          data-testid="vocabify-save-action"
        >
          {saving ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
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
          className="h-9 w-9 rounded-[8px]"
          onClick={() => startAIStream()}
          disabled={isLoading}
          aria-label="Retry"
          title="Retry"
          data-testid="vocabify-retry-action"
        >
          <RefreshCw className={cn(isLoading && 'animate-spin')} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-[8px]"
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

const LoadingState = () => (
  <div className="flex h-full min-h-0 flex-col gap-3 px-4 py-4" data-testid="vocabify-ai-loading">
    <div className="vocabify-skeleton-breathe h-3.5 w-24 rounded" />
    <div className="space-y-2">
      <div className="vocabify-skeleton-breathe h-3 w-full rounded" />
      <div className="vocabify-skeleton-breathe h-3 w-[92%] rounded" style={{ animationDelay: '0.08s' }} />
      <div className="vocabify-skeleton-breathe h-3 w-[74%] rounded" style={{ animationDelay: '0.16s' }} />
    </div>
    <div className="vocabify-skeleton-breathe h-3.5 w-16 rounded" style={{ animationDelay: '0.24s' }} />
    <div className="space-y-2">
      <div className="vocabify-skeleton-breathe h-3 w-[86%] rounded" style={{ animationDelay: '0.32s' }} />
      <div className="vocabify-skeleton-breathe h-3 w-[64%] rounded" style={{ animationDelay: '0.40s' }} />
    </div>
    <p className="mt-auto text-[10px] text-muted-foreground">Generating explanation…</p>
  </div>
)

function ErrorState({ error }: { error: string | null }) {
  const detail = error || 'Check your provider key, model access, or network connection.'
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="vocabify-ai-error">
      <div className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-start gap-2 text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display text-[13px] font-semibold tracking-tight">AI explanation failed</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-destructive/80">
              Retry, or adjust your provider settings.
            </p>
          </div>
        </div>
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-[8px] border border-destructive/20 bg-destructive/5 p-3 font-mono text-[11px] leading-relaxed text-destructive/90">{detail}</pre>
      </div>
    </div>
  )
}

const EmptyResult = () => (
  <div className="flex h-full items-center justify-center px-4 py-6 text-center text-[12px] leading-relaxed text-muted-foreground">
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
      <div
        ref={scrollRef}
        className="vocabify-fade-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-scroll px-4 py-4"
        data-testid="vocabify-ai-result-scroll"
      >
        <div className="flex min-h-full w-full min-w-0 flex-col gap-3 text-[13px] leading-relaxed text-foreground/90">
          {blocks.map((block, index) => {
            if (block.type === 'heading') {
              return (
                <h3 key={index} className="font-display text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {block.text}
                </h3>
              )
            }
            if (block.type === 'list') {
              return (
                <ul key={index} className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground/60">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )
            }
            return (
              <p key={index} className="min-w-0 break-words">
                {block.text}
              </p>
            )
          })}
          {streaming ? <span className="inline-block h-3.5 w-1 rounded-full bg-primary animate-ai-pulse" aria-hidden /> : null}
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

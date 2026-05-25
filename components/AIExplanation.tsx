import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveRecord } from '@/lib/vocabifyDb'
import { Check, Save, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AIExplanationProps {
  selectedText: string
}

export function AIExplanation({ selectedText }: AIExplanationProps) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  useEffect(() => {
    if (selectedText) {
      startAIStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedText])

  async function startAIStream() {
    setLoading(true)
    setExplanation('')
    setSavedKey(null)

    try {
      const port = chrome.runtime.connect({ name: 'ai-stream' })

      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          setExplanation((prev) => prev + msg.chunk)
        } else if (msg.type === 'complete') {
          setLoading(false)
          port.disconnect()
        } else if (msg.type === 'error') {
          console.error('AI stream error:', msg.error)
          setExplanation('Error: ' + msg.error)
          setLoading(false)
          port.disconnect()
        }
      })

      port.postMessage({ type: 'start', text: selectedText })
    } catch (error) {
      console.error('Failed to start AI stream:', error)
      setExplanation('Failed to get AI explanation')
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!explanation.trim()) return
    setSaving(true)
    try {
      const result = await saveRecord(selectedText, explanation)
      setSavedKey(selectedText)
      toast.success(result.title.replace(/[^A-Za-z]/g, '').trim() || 'Saved', {
        description: result.detail,
      })
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  function speak() {
    try {
      const u = new SpeechSynthesisUtterance(selectedText)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch (e) {
      console.error('TTS failed:', e)
    }
  }

  const isSaved = savedKey === selectedText

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Selected text card */}
      <section
        className="rounded-xl border border-border/70 bg-card text-card-foreground p-4 shadow-apple-xs"
        aria-label="Selected text"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
              Selection
            </p>
            <p className="mt-1 font-display text-[16px] leading-snug font-semibold tracking-tight text-foreground break-words">
              {selectedText}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={speak}
            aria-label="Pronounce selection"
            title="Pronounce"
            className="text-muted-foreground hover:text-primary shrink-0"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* AI explanation */}
      <section className="flex flex-1 min-h-0 flex-col gap-2">
        <header className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
            AI Explanation
          </p>
          {loading && <StreamingIndicator />}
        </header>

        <div className="relative flex-1 min-h-0">
          {loading && !explanation ? (
            <SkeletonStream />
          ) : (
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="AI explanation will appear here..."
              className="h-full resize-none scrollbar-thin"
              aria-label="AI explanation"
            />
          )}
        </div>
      </section>

      <Button
        onClick={handleSave}
        disabled={saving || !explanation.trim() || isSaved}
        size="lg"
        className={cn("w-full", isSaved && "bg-success text-white hover:bg-success/90")}
      >
        {saving ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            Saving…
          </>
        ) : isSaved ? (
          <>
            <Check className="h-4 w-4" />
            Saved to Vocabulary
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save to Vocabulary
          </>
        )}
      </Button>
    </div>
  )
}

const StreamingIndicator = () => (
  <span className="inline-flex items-center gap-1" aria-label="AI is responding">
    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ai-pulse" />
    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ai-pulse [animation-delay:.15s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ai-pulse [animation-delay:.3s]" />
  </span>
)

const SkeletonStream = () => (
  <div className="absolute inset-0 rounded-lg border border-border bg-secondary/40 p-4 space-y-2">
    <div className="h-3 w-3/4 rounded-md bg-secondary animate-ai-pulse" />
    <div className="h-3 w-full rounded-md bg-secondary animate-ai-pulse" />
    <div className="h-3 w-5/6 rounded-md bg-secondary animate-ai-pulse" />
    <div className="h-3 w-2/3 rounded-md bg-secondary animate-ai-pulse" />
  </div>
)

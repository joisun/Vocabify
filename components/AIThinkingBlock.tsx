import { cn } from '@/lib/utils'

export function AIThinkingBlock({
  active = true,
  label = 'Thinking',
  compact = false,
  className,
}: {
  active?: boolean
  label?: string
  compact?: boolean
  className?: string
}) {
  if (!active) return null

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-[6px] bg-secondary/40 text-[11px] leading-5 text-muted-foreground dark:bg-white/[0.04]',
        compact ? 'px-2 py-1' : 'px-2.5 py-1',
        className,
      )}
      data-testid="vocabify-stream-thinking"
      aria-live="polite"
    >
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/55 animate-ai-pulse" />
        <span className="h-1 w-1 rounded-full bg-muted-foreground/55 animate-ai-pulse [animation-delay:120ms]" />
        <span className="h-1 w-1 rounded-full bg-muted-foreground/55 animate-ai-pulse [animation-delay:240ms]" />
      </span>
    </div>
  )
}

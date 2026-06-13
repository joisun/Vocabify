import React from 'react'
import { Button } from '@/components/ui/button'
import { BookOpen, Brain, Check, Copy, HelpCircle, X } from 'lucide-react'
import { copyHandler } from '../utils'
import { NO_SELECTION_CONTAINER } from '@/const'
import {
  FAMILIARITY_LEVELS,
  levelClassSuffix,
  type FamiliarityLevel,
  type MarkAction,
} from '@/lib/familiarity'

export type SelectionRect = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export type SavedRecordSummary = {
  id: number
  wordOrPhrase: string
  score: number
  level: FamiliarityLevel
}

const POPOVER_MAX_WIDTH = 380
const POPOVER_MIN_WIDTH = 320
const POPOVER_MARGIN = 12
const POPOVER_GAP = 8
export const SELECTION_POPOVER_ESTIMATED_HEIGHT = 92

function TooltipBtn({
  text,
  rect,
  placement,
  savedRecord,
  cancelHandler,
  vocabifyHandler,
  markHandler,
  onPointerEnter,
  onPointerLeave,
}: {
  text: string
  rect: SelectionRect
  placement: 'top' | 'bottom'
  savedRecord: SavedRecordSummary | null
  vocabifyHandler: (text: string) => void
  markHandler: (id: number, action: MarkAction) => void
  cancelHandler: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}) {
  const viewport = getViewportBounds()
  const availableWidth = Math.max(160, viewport.width - POPOVER_MARGIN * 2)
  const preferredWidth = text.length > 56 ? POPOVER_MAX_WIDTH : POPOVER_MIN_WIDTH
  const popoverWidth = Math.min(
    Math.max(preferredWidth, Math.min(POPOVER_MIN_WIDTH, availableWidth)),
    availableWidth,
  )
  const halfWidth = popoverWidth / 2
  const safeLeft = clamp(
    rect.left + rect.width / 2,
    viewport.left + POPOVER_MARGIN + halfWidth,
    viewport.right - POPOVER_MARGIN - halfWidth,
  )
  const safeTop = placement === 'top'
    ? clamp(
        rect.top - POPOVER_GAP,
        viewport.top + POPOVER_MARGIN + SELECTION_POPOVER_ESTIMATED_HEIGHT,
        viewport.bottom - POPOVER_MARGIN,
      )
    : clamp(
        rect.bottom + POPOVER_GAP,
        viewport.top + POPOVER_MARGIN,
        viewport.bottom - POPOVER_MARGIN - SELECTION_POPOVER_ESTIMATED_HEIGHT,
      )
  const previewText = compactSelection(text)
  const isSaved = Boolean(savedRecord)

  return (
    <div
      className={cn(
        NO_SELECTION_CONTAINER,
        'fixed pointer-events-auto z-[2147483647]',
        placement === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2',
      )}
      style={{ left: safeLeft, top: safeTop, width: popoverWidth }}
      role="toolbar"
      aria-label="Vocabify selection actions"
      data-testid="vocabify-selection-popover"
      onMouseDown={(event) => event.preventDefault()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="overflow-hidden rounded-[10px] border border-border bg-popover text-popover-foreground animate-scale-in dark:border-white/8">
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
          <div className="min-w-0 flex-1">
            <p className={cn(
              'line-clamp-2 min-w-0 break-words font-display text-[14px] font-semibold leading-[18px]',
              text.length > 32 ? 'text-muted-foreground' : 'text-foreground',
            )}>
              {previewText}
            </p>
            {isSaved && savedRecord ? (
              <LevelChip level={savedRecord.level} score={savedRecord.score} />
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={cancelHandler}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isSaved && savedRecord ? (
          <div className="flex items-center gap-1 border-t border-border px-1.5 py-1.5 dark:border-white/8" data-testid="vocabify-mark-actions">
            <MarkButton
              label="Know"
              icon={<Check className="h-3.5 w-3.5" />}
              tone="positive"
              onClick={() => markHandler(savedRecord.id, 'KNOW')}
              testId="vocabify-mark-know"
            />
            <MarkButton
              label="Fuzzy"
              icon={<Brain className="h-3.5 w-3.5" />}
              tone="neutral"
              onClick={() => markHandler(savedRecord.id, 'FUZZY')}
              testId="vocabify-mark-fuzzy"
            />
            <MarkButton
              label="Forget"
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              tone="negative"
              onClick={() => markHandler(savedRecord.id, 'FORGET')}
              testId="vocabify-mark-forget"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 border-t border-border px-1.5 py-1.5 dark:border-white/8">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-8 flex-1 rounded-md text-[12px] font-medium"
              onClick={() => vocabifyHandler(text)}
              aria-label="Explain selection with AI"
              data-testid="vocabify-explain-action"
            >
              <BookOpen data-icon="inline-start" />
              Explain
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => copyHandler(text)}
              aria-label="Copy selected text"
              title="Copy"
            >
              <Copy />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function LevelChip({ level, score }: { level: FamiliarityLevel; score: number }) {
  const meta = FAMILIARITY_LEVELS[level]
  const suffix = levelClassSuffix(level)
  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/8">
      <span
        className={`vocabify-level-dot is-${suffix}`}
        aria-hidden
      />
      <span className="text-foreground/80">{meta.label}</span>
      <span className="text-muted-foreground/70">·</span>
      <span className="tabular text-muted-foreground">{score}</span>
    </div>
  )
}

function MarkButton({
  label,
  icon,
  tone,
  onClick,
  testId,
}: {
  label: string
  icon: React.ReactNode
  tone: 'positive' | 'neutral' | 'negative'
  onClick: () => void
  testId: string
}) {
  const toneClass = {
    positive: 'text-foreground hover:bg-secondary',
    neutral: 'text-foreground hover:bg-secondary',
    negative: 'text-foreground hover:bg-secondary',
  }[tone]

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn(
        'h-8 flex-1 rounded-md px-2 text-[12px] font-medium',
        toneClass,
      )}
      onClick={onClick}
      data-testid={testId}
      aria-label={`Mark as ${label}`}
    >
      {icon}
      {label}
    </Button>
  )
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function compactSelection(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 150 ? `${normalized.slice(0, 147)}...` : normalized
}

function getViewportBounds() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 360, bottom: 640, left: 0, width: 360, height: 640 }
  }

  const viewport = window.visualViewport
  const left = viewport?.offsetLeft ?? 0
  const top = viewport?.offsetTop ?? 0
  const width = viewport?.width ?? window.innerWidth
  const height = viewport?.height ?? window.innerHeight

  return {
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
  }
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return min
  return Math.min(Math.max(value, min), max)
}

export default TooltipBtn

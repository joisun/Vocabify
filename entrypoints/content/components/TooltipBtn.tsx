import React from 'react'
import { Button } from '@/components/ui/button'
import { BookOpen, Copy, X } from 'lucide-react'
import { copyHandler } from '../utils'
import { NO_SELECTION_CONTAINER } from '@/const'

export type SelectionRect = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

const POPOVER_MAX_WIDTH = 380
const POPOVER_MIN_WIDTH = 340
const POPOVER_MARGIN = 12
const POPOVER_GAP = 8
export const SELECTION_POPOVER_ESTIMATED_HEIGHT = 92

function TooltipBtn({
  text,
  rect,
  placement,
  cancelHandler,
  vocabifyHandler,
}: {
  text: string
  rect: SelectionRect
  placement: 'top' | 'bottom'
  vocabifyHandler: (text: string) => void
  cancelHandler: () => void
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
    >
      <div className="overflow-hidden rounded-[10px] liquid-glass-card text-popover-foreground shadow-apple-md animate-scale-in">
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
          <p className={cn(
            'line-clamp-2 min-w-0 break-words text-[14px] font-semibold leading-[18px]',
            text.length > 32 ? 'text-muted-foreground' : 'text-foreground',
          )}>
            {previewText}
          </p>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={cancelHandler}
            aria-label="Dismiss selection actions"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-t border-white/16 p-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="liquid-glass-button h-8 flex-1 rounded-md px-2.5 text-[12px] font-semibold text-black shadow-none hover:text-black dark:text-black dark:hover:text-black"
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
            className="liquid-glass-button h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => copyHandler(text)}
            aria-label="Copy selected text"
            title="Copy"
          >
            <Copy />
          </Button>
        </div>
      </div>
    </div>
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

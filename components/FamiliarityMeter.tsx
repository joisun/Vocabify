import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  getLevel,
  getMemorySnapshot,
  levelClassSuffix,
  type FamiliarityFields,
} from '@/lib/familiarity'
import { cn } from '@/lib/utils'

export function FamiliarityMeter({
  record,
  align = 'center',
  className,
  curveClassName,
  hideCurveTitle = false,
  expanded,
  onExpandedChange,
  renderCurve = true,
}: {
  record: FamiliarityFields
  align?: 'left' | 'center' | 'right'
  className?: string
  curveClassName?: string
  hideCurveTitle?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  renderCurve?: boolean
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded = expanded ?? internalExpanded
  const score = record.score
  const level = getLevel(score)
  const suffix = levelClassSuffix(level)
  const filled = Math.ceil(Math.max(0, Math.min(100, score)) / 5)

  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center gap-[2px] rounded-[5px] px-1 py-1 transition-colors',
          'hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
          align === 'left' && 'justify-start',
        )}
        aria-label={`Familiarity score ${score}. Toggle memory curve.`}
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.stopPropagation()
          const next = !isExpanded
          onExpandedChange?.(next)
          if (expanded === undefined) setInternalExpanded(next)
        }}
      >
        <span className="inline-flex items-center gap-[2px]" aria-hidden>
          {Array.from({ length: 20 }).map((_, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={cn(
                'h-1 w-1 rounded-full bg-muted-foreground/20',
                index < filled && `vocabify-level-dot-fill is-${suffix}`,
              )}
            />
          ))}
        </span>
        <ChevronDown
          className={cn(
            'ml-0.5 h-3 w-3 text-muted-foreground/70 transition-transform',
            isExpanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {renderCurve && isExpanded ? (
        <MemoryCurvePanel record={record} className={curveClassName} hideTitle={hideCurveTitle} />
      ) : null}
    </div>
  )
}

export function MemoryCurvePanel({
  record,
  className,
  hideTitle = false,
}: {
  record: FamiliarityFields
  className?: string
  hideTitle?: boolean
}) {
  const snapshot = getMemorySnapshot(record)
  const width = 280
  const height = 96
  const paddingX = 12
  const paddingY = 10
  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingY * 2
  const points = snapshot.points.map((point) => ({
    x: paddingX + point.elapsedRatio * plotWidth,
    y: paddingY + (1 - point.y) * plotHeight,
  }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const currentX = paddingX + snapshot.elapsedRatio * plotWidth
  const currentY = paddingY + (1 - snapshot.currentScore / 100) * plotHeight
  const elapsedLabel = snapshot.horizonDays > 0
    ? `${Math.min(snapshot.elapsedDays, snapshot.horizonDays).toFixed(snapshot.elapsedDays < 1 ? 1 : 0)}d / ${snapshot.horizonDays}d`
    : 'No decay window'
  const horizonLabel = snapshot.horizonDays > 0 ? `${snapshot.horizonDays}d later` : 'Later'
  const summary = snapshot.horizonDays > 0
    ? `${snapshot.currentScore} now · may decay to ${snapshot.projectedEndScore} in ${snapshot.horizonDays}d`
    : `${snapshot.currentScore} now · no scheduled decay`

  return (
    <div
      className={cn(
        'mt-1.5 rounded-[7px] border border-border/50 bg-secondary/35 px-2 py-2 text-left dark:border-white/[0.04]',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      data-testid="vocabify-memory-curve"
    >
      {hideTitle ? null : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Memory forecast</span>
          <span className="tabular text-[10px] text-muted-foreground">{elapsedLabel}</span>
        </div>
      )}
      <p className={cn('text-[11px] font-medium leading-4 text-foreground/85', !hideTitle && 'mt-1')}>{summary}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Memory curve from ${snapshot.anchorScore} to ${snapshot.projectedEndScore}, current score ${snapshot.currentScore}`}
        className="mt-1.5 h-24 w-full overflow-visible"
      >
        <line x1={paddingX} y1={paddingY} x2={paddingX + plotWidth} y2={paddingY} className="stroke-foreground/10" strokeWidth="1" />
        <line x1={paddingX} y1={paddingY + plotHeight} x2={paddingX + plotWidth} y2={paddingY + plotHeight} className="stroke-foreground/10" strokeWidth="1" />
        <line x1={currentX} y1={paddingY} x2={currentX} y2={paddingY + plotHeight} className="stroke-primary/30" strokeWidth="1" strokeDasharray="3 3" />
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={currentX} cy={currentY} r="3.2" className="fill-card stroke-primary" strokeWidth="2" />
        <text x={paddingX} y={height - 2} className="fill-muted-foreground" fontSize="8">time</text>
        <text x={paddingX} y={paddingY - 2} className="fill-muted-foreground" fontSize="8">score</text>
      </svg>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] leading-4 text-muted-foreground">
        <span>Last review <b className="tabular font-medium text-foreground/85">{snapshot.anchorScore}</b></span>
        <span className="text-center">Today <b className="tabular font-medium text-foreground/85">{snapshot.currentScore}</b></span>
        <span className="text-right">{horizonLabel} <b className="tabular font-medium text-foreground/85">{snapshot.projectedEndScore}</b></span>
      </div>
    </div>
  )
}

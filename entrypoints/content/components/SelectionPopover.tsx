import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BookOpen, Brain, Check, Copy, Edit3, HelpCircle,
  MoreHorizontal, Plus, Save, Search, Trash2, Volume2, X,
} from 'lucide-react'
import { NO_SELECTION_CONTAINER } from '@/const'
import {
  FAMILIARITY_LEVELS,
  levelClassSuffix,
  type FamiliarityLevel,
  type MarkAction,
} from '@/lib/familiarity'
import type { VocabResponse } from '@/lib/aiSchema'
import type { PosType, VocabRecord } from '@/lib/vocabifyDb'
import { cn } from '@/lib/utils'

export type SelectionRect = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export type PopoverMode = 'operation-bar' | 'card' | 'edit'

export interface SelectionPopoverProps {
  rect: SelectionRect
  placement: 'top' | 'bottom'
  mode: PopoverMode

  // Common
  onDismiss: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void

  // Operation-bar mode (new word, pre-query)
  selectionText?: string
  onQuery?: () => void
  onCopy?: () => void

  // Card / edit modes — feeds the structured renderer
  record?: Partial<VocabResponse> | VocabRecord
  streaming?: boolean
  errorMessage?: string | null

  // Card mode footer actions
  savedRecord?: VocabRecord | null
  onSave?: () => void
  onMark?: (action: MarkAction) => void
  onEnterEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
  onSpeak?: () => void

  // Edit mode
  onEditCommit?: (next: EditableFields) => void
  onEditCancel?: () => void
  saving?: boolean
}

export interface EditableFields {
  term: string
  phonetic: string
  pos: PosType
  senses: Array<{ definition: string; example: string; exampleTranslation: string }>
  mnemonic: string
}

const POPOVER_MAX_WIDTH = 320
const POPOVER_MIN_WIDTH = 280
const OPERATION_BAR_MAX_WIDTH = 260
const OPERATION_BAR_MIN_WIDTH = 200
const POPOVER_MARGIN = 12
const POPOVER_GAP = 8
const DEFAULT_HEIGHT = 64

export function SelectionPopover(props: SelectionPopoverProps) {
  const {
    rect, placement, mode,
    onDismiss, onPointerEnter, onPointerLeave,
  } = props

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const next = containerRef.current.getBoundingClientRect().height
    if (next > 0 && next !== measuredHeight) setMeasuredHeight(next)
  })

  const viewport = getViewportBounds()
  const minWidth = mode === 'operation-bar' ? OPERATION_BAR_MIN_WIDTH : POPOVER_MIN_WIDTH
  const maxWidth = mode === 'operation-bar' ? OPERATION_BAR_MAX_WIDTH : POPOVER_MAX_WIDTH
  const popoverWidth = Math.min(maxWidth, Math.max(minWidth, viewport.width - POPOVER_MARGIN * 2))
  const halfWidth = popoverWidth / 2
  const effectiveHeight = measuredHeight ?? DEFAULT_HEIGHT
  const isMeasured = measuredHeight != null

  const safeLeft = clamp(
    rect.left + rect.width / 2,
    viewport.left + POPOVER_MARGIN + halfWidth,
    viewport.right - POPOVER_MARGIN - halfWidth,
  )
  const safeTop = placement === 'top'
    ? clamp(rect.top - POPOVER_GAP, viewport.top + POPOVER_MARGIN + effectiveHeight, viewport.bottom - POPOVER_MARGIN)
    : clamp(rect.bottom + POPOVER_GAP, viewport.top + POPOVER_MARGIN, viewport.bottom - POPOVER_MARGIN - effectiveHeight)

  return (
    <div
      ref={containerRef}
      className={cn(
        NO_SELECTION_CONTAINER,
        'dark',
        'fixed z-[2147483647]',
        isMeasured ? 'pointer-events-auto' : 'pointer-events-none invisible',
        placement === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2',
      )}
      style={{ left: safeLeft, top: safeTop, width: popoverWidth }}
      role="dialog"
      aria-label="Vocabify"
      data-testid="vocabify-selection-popover"
      onMouseDown={(e) => e.preventDefault()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="overflow-hidden rounded-md border border-white/8 bg-popover text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
        {mode === 'operation-bar' && (
          <OperationBar
            text={props.selectionText || ''}
            onQuery={props.onQuery}
            onCopy={props.onCopy}
            onDismiss={onDismiss}
          />
        )}
        {mode === 'card' && (
          <Card
            record={props.record}
            streaming={props.streaming}
            errorMessage={props.errorMessage}
            savedRecord={props.savedRecord}
            onSave={props.onSave}
            onMark={props.onMark}
            onEnterEdit={props.onEnterEdit}
            onDelete={props.onDelete}
            onRetry={props.onRetry}
            onSpeak={props.onSpeak}
            onDismiss={onDismiss}
          />
        )}
        {mode === 'edit' && props.record && (
          <EditCard
            record={props.record}
            saving={props.saving}
            onCommit={props.onEditCommit}
            onCancel={props.onEditCancel}
          />
        )}
      </div>
    </div>
  )
}

// ───────────────────────────── Operation Bar ─────────────────────────────

function OperationBar({
  text, onQuery, onCopy, onDismiss,
}: {
  text: string
  onQuery?: () => void
  onCopy?: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex items-stretch gap-1 px-2 py-1.5">
      <span className="flex min-w-0 flex-1 items-center px-2 text-[13px] font-medium text-white/60">
        <span className="truncate" title={text}>{text}</span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 rounded-md px-2.5 text-[12px] text-white/90 hover:bg-white/10 hover:text-white"
        onClick={onQuery}
        aria-label="Query"
        data-testid="vocabify-operation-query"
      >
        <Search className="h-3.5 w-3.5" />
        查询
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
        onClick={onCopy}
        aria-label="Copy"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
        aria-label="More"
        title="More"
        disabled
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ───────────────────────────── Card (read-only structured view) ─────────────────────────────

function Card({
  record, streaming, errorMessage, savedRecord,
  onSave, onMark, onEnterEdit, onDelete, onRetry, onSpeak, onDismiss,
}: {
  record?: Partial<VocabResponse> | VocabRecord
  streaming?: boolean
  errorMessage?: string | null
  savedRecord?: VocabRecord | null
  onSave?: () => void
  onMark?: (action: MarkAction) => void
  onEnterEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
  onSpeak?: () => void
  onDismiss: () => void
}) {
  const term = record?.term
  const phonetic = record?.phonetic
  const pos = record?.pos
  const senses = record?.senses
  const mnemonic = record?.mnemonic

  return (
    <div className="flex flex-col">
      {/* Header: term + phonetic + pos chip + close */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-white truncate">
              {term || <SkeletonInline width={80} />}
            </h2>
            {onSpeak && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onSpeak}
                className="h-5 w-5 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Pronounce"
                title="Pronounce"
              >
                <Volume2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-white/50">
              {phonetic || (streaming ? <SkeletonInline width={64} /> : '—')}
            </span>
            {pos && (
              <span className="rounded bg-white/10 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-white/70">
                {pos}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body: senses + mnemonic */}
      <div className="flex-1 overflow-y-auto vocabify-fade-scroll px-3 py-1 max-h-[380px]">
        {errorMessage ? (
          <div className="my-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[12px] text-red-400">
            <p className="font-medium">AI explanation failed</p>
            <p className="mt-1 text-red-400/80">{errorMessage}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 h-7 text-[11px]">
                Retry
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Senses */}
            {(senses && senses.length > 0) ? (
              <div className="space-y-1.5 py-1">
                {senses.map((sense, i) => (
                  <SenseRow key={i} index={i} sense={sense} streaming={streaming} />
                ))}
              </div>
            ) : streaming ? (
              <div className="space-y-1.5 py-1">
                <SenseSkeleton />
              </div>
            ) : null}

            {/* Mnemonic */}
            {(mnemonic || streaming) && (
              <div className="mt-2 border-t border-white/8 pt-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                  联想记忆
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/80">
                  {mnemonic || (streaming ? <SkeletonInline width={200} /> : null)}
                </p>
              </div>
            )}

            {/* Source URL for saved records */}
            {savedRecord?.sourceUrl && (
              <p className="mt-2 truncate text-[10px] text-white/50">
                源: <a href={savedRecord.sourceUrl} target="_blank" rel="noreferrer" className="text-[#5b5bf8] hover:underline">{new URL(savedRecord.sourceUrl).hostname}</a>
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-white/8 px-2 py-1.5">
        {savedRecord ? (
          <SavedFooter
            savedRecord={savedRecord}
            onMark={onMark}
            onEnterEdit={onEnterEdit}
            onDelete={onDelete}
          />
        ) : (
          <NewWordFooter
            canSave={!streaming && !!record?.term && (record?.senses?.length || 0) > 0 && !errorMessage}
            onSave={onSave}
            onEnterEdit={onEnterEdit}
            streaming={streaming}
          />
        )}
      </div>
    </div>
  )
}

function SenseRow({
  index, sense, streaming,
}: {
  index: number
  sense: { definition?: string; example?: string; exampleTranslation?: string }
  streaming?: boolean
}) {
  const num = `①②③`[index] || `${index + 1}`
  return (
    <div className="rounded border border-white/8 bg-[#323232] px-2.5 py-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium text-[#5b5bf8]">{num}</span>
        <p className="text-[12px] leading-relaxed text-white/90">
          {sense.definition || (streaming ? <SkeletonInline width={140} /> : null)}
        </p>
      </div>
      {(sense.example || streaming) && (
        <p className="mt-1 text-[11px] italic leading-relaxed text-white/60">
          "{sense.example || (streaming ? <SkeletonInline width={180} /> : '')}"
        </p>
      )}
      {sense.exampleTranslation && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">
          {sense.exampleTranslation}
        </p>
      )}
    </div>
  )
}

function SenseSkeleton() {
  return (
    <div className="rounded border border-white/8 bg-[#323232] px-2.5 py-1.5">
      <div className="vocabify-skeleton-breathe h-3.5 w-4/5 rounded" />
      <div className="vocabify-skeleton-breathe mt-2 h-3 w-full rounded" style={{ animationDelay: '0.08s' }} />
      <div className="vocabify-skeleton-breathe mt-1 h-3 w-3/5 rounded" style={{ animationDelay: '0.16s' }} />
    </div>
  )
}

function SkeletonInline({ width = 80 }: { width?: number }) {
  return (
    <span
      className="vocabify-skeleton-breathe inline-block h-3 rounded align-middle"
      style={{ width }}
      aria-hidden
    />
  )
}

// ───────────────────────────── Footers ─────────────────────────────

function NewWordFooter({
  canSave, onSave, onEnterEdit, streaming,
}: {
  canSave: boolean
  onSave?: () => void
  onEnterEdit?: () => void
  streaming?: boolean
}) {
  return (
    <div className="flex w-full items-center gap-1">
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEnterEdit}
        disabled={streaming || !canSave}
        aria-label="Edit"
        title="Edit"
        className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
      >
        <Edit3 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSave}
        disabled={!canSave}
        className="h-7 rounded-md px-2.5 text-[12px] text-white/90 hover:bg-white/10 hover:text-white"
        data-testid="vocabify-save-action"
      >
        <Plus className="h-3.5 w-3.5" />
        加入词库
      </Button>
    </div>
  )
}

function SavedFooter({
  savedRecord, onMark, onEnterEdit, onDelete,
}: {
  savedRecord: VocabRecord
  onMark?: (action: MarkAction) => void
  onEnterEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <>
      <LevelChip score={savedRecord.score} />
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-md px-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white"
        onClick={() => onMark?.('KNOW')}
        data-testid="vocabify-mark-know"
      >
        <Check className="h-3 w-3" />
        Know
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-md px-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white"
        onClick={() => onMark?.('FUZZY')}
        data-testid="vocabify-mark-fuzzy"
      >
        <Brain className="h-3 w-3" />
        Fuzzy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-md px-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white"
        onClick={() => onMark?.('FORGET')}
        data-testid="vocabify-mark-forget"
      >
        <HelpCircle className="h-3 w-3" />
        Forget
      </Button>
      <span className="mx-0.5 h-4 w-px bg-white/10" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEnterEdit}
        aria-label="Edit"
        title="Edit"
        className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        aria-label="Delete"
        title="Delete"
        className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-red-400"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </>
  )
}

function LevelChip({ score }: { score: number }) {
  const level: FamiliarityLevel =
    score <= 0 ? 'NEW' :
    score <= 40 ? 'LEARNING' :
    score <= 70 ? 'FAMILIAR' : 'MASTERED'
  const meta = FAMILIARITY_LEVELS[level]
  const suffix = levelClassSuffix(level)
  return (
    <div className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
      <span className={`vocabify-level-dot is-${suffix}`} aria-hidden />
      <span className="text-white/70">{meta.label}</span>
      <span className="tabular text-white/80">{score}</span>
    </div>
  )
}

// ───────────────────────────── Edit Card ─────────────────────────────

function EditCard({
  record, saving, onCommit, onCancel,
}: {
  record: Partial<VocabResponse> | VocabRecord
  saving?: boolean
  onCommit?: (fields: EditableFields) => void
  onCancel?: () => void
}) {
  const [term, setTerm] = useState(record.term || '')
  const [phonetic, setPhonetic] = useState(record.phonetic || '')
  const [pos, setPos] = useState<PosType>((record.pos as PosType) || 'other')
  const [mnemonic, setMnemonic] = useState(record.mnemonic || '')
  const [senses, setSenses] = useState<EditableFields['senses']>(
    (record.senses || []).map((s) => ({
      definition: s.definition || '',
      example: s.example || '',
      exampleTranslation: s.exampleTranslation || '',
    })),
  )

  function updateSense(idx: number, patch: Partial<EditableFields['senses'][number]>) {
    setSenses((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  function addSense() {
    if (senses.length >= 3) return
    setSenses([...senses, { definition: '', example: '', exampleTranslation: '' }])
  }
  function removeSense(idx: number) {
    if (senses.length <= 1) return
    setSenses(senses.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[380px] overflow-y-auto vocabify-fade-scroll px-3 pt-2.5 pb-2 space-y-2.5">
        <div className="grid grid-cols-[1fr_100px_70px] gap-2">
          <Field label="Term">
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="bg-[#323232] border-white/8 text-white" />
          </Field>
          <Field label="Phonetic">
            <Input value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="/.../" className="bg-[#323232] border-white/8 text-white" />
          </Field>
          <Field label="POS">
            <select
              value={pos}
              onChange={(e) => setPos(e.target.value as PosType)}
              className="h-8 w-full rounded-md border border-white/8 bg-[#323232] px-2 text-[12px] text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5b5bf8]"
            >
              {(['n', 'v', 'adj', 'adv', 'phrase', 'other'] as PosType[]).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
              Senses ({senses.length}/3)
            </span>
            <Button variant="ghost" size="sm" onClick={addSense} disabled={senses.length >= 3} className="h-6 px-1.5 text-[11px] text-white/70 hover:bg-white/10 hover:text-white">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>

          {senses.map((sense, i) => (
            <div key={i} className="rounded border border-white/8 bg-[#323232] p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#5b5bf8]">{`①②③`[i] || i + 1}</span>
                {senses.length > 1 && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeSense(i)} className="ml-auto h-5 w-5 text-white/50 hover:bg-white/10 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Input value={sense.definition} placeholder="Definition" onChange={(e) => updateSense(i, { definition: e.target.value })} className="bg-[#2b2b2b] border-white/8 text-white" />
              <Input value={sense.example} placeholder="Example" onChange={(e) => updateSense(i, { example: e.target.value })} className="bg-[#2b2b2b] border-white/8 text-white" />
              <Input value={sense.exampleTranslation} placeholder="Example translation" onChange={(e) => updateSense(i, { exampleTranslation: e.target.value })} className="bg-[#2b2b2b] border-white/8 text-white" />
            </div>
          ))}
        </div>

        <Field label="Mnemonic">
          <Textarea value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} rows={2} className="bg-[#323232] border-white/8 text-white" />
        </Field>
      </div>

      <div className="flex items-center gap-1 border-t border-white/8 px-2 py-1.5">
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="h-7 rounded-md px-3 text-[12px] text-white/70 hover:bg-white/10 hover:text-white">
          取消
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCommit?.({ term, phonetic, pos, senses, mnemonic })}
          disabled={saving || !term.trim() || senses.length === 0}
          className="h-7 rounded-md px-3 text-[12px] text-white/90 hover:bg-white/10 hover:text-white"
        >
          {saving ? '…' : <><Save className="h-3.5 w-3.5" /> 保存</>}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

// ───────────────────────────── Utils ─────────────────────────────

function getViewportBounds() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 360, bottom: 640, left: 0, width: 360, height: 640 }
  }
  const viewport = window.visualViewport
  const left = viewport?.offsetLeft ?? 0
  const top = viewport?.offsetTop ?? 0
  const width = viewport?.width ?? window.innerWidth
  const height = viewport?.height ?? window.innerHeight
  return { top, right: left + width, bottom: top + height, left, width, height }
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return min
  return Math.min(Math.max(value, min), max)
}

// Re-export for content/index.tsx position calculations
export const SELECTION_POPOVER_ESTIMATED_HEIGHT = DEFAULT_HEIGHT

// Suppress unused import warning if BookOpen ever needed
void BookOpen

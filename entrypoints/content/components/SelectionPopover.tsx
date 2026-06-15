import React from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  Brain, Check, Copy, Edit3, HelpCircle,
  MoreHorizontal, Plus, Search, Trash2, Volume2, X,
} from 'lucide-react'
import { NO_SELECTION_CONTAINER } from '@/const'
import {
  FAMILIARITY_LEVELS,
  levelClassSuffix,
  type FamiliarityLevel,
  type MarkAction,
} from '@/lib/familiarity'
import type { VocabResponse } from '@/lib/aiSchema'
import type { VocabRecord } from '@/lib/vocabifyDb'
import { cn } from '@/lib/utils'
import { RecordEditForm, type EditableFields } from '@/components/RecordEditForm'

export type { EditableFields } from '@/components/RecordEditForm'

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
  open: boolean
  rect: SelectionRect | null
  mode: PopoverMode
  portalContainer?: HTMLElement | null

  onDismiss: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void

  selectionText?: string
  onQuery?: () => void
  onCopy?: () => void

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

  onEditCommit?: (next: EditableFields) => void
  onEditCancel?: () => void
  saving?: boolean
}

export function SelectionPopover(props: SelectionPopoverProps) {
  const { open, rect, mode, portalContainer, onDismiss, onPointerEnter, onPointerLeave } = props

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div
          style={{
            position: 'fixed',
            left: rect?.left ?? 0,
            top: rect?.top ?? 0,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            pointerEvents: 'none',
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        container={portalContainer}
        className={cn(
          NO_SELECTION_CONTAINER,
          'dark w-auto min-w-[200px] max-w-[320px] p-0 border-white/8 bg-popover text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15)]',
        )}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          e.preventDefault()
          onDismiss()
        }}
        onEscapeKeyDown={onDismiss}
        onMouseDown={(e) => {
          const tag = (e.target as HTMLElement).tagName
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault()
          }
        }}
      >
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
      </PopoverContent>
    </Popover>
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

// ───────────────────────────── Card ─────────────────────────────

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
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-white truncate">
              {term || <Skeleton width={80} />}
            </h2>
            {onSpeak && (
              <Button variant="ghost" size="icon-sm" onClick={onSpeak} className="h-5 w-5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Pronounce" title="Pronounce">
                <Volume2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-white/50">
              {phonetic || (streaming ? <Skeleton width={64} /> : '—')}
            </span>
            {pos && (
              <span className="rounded bg-white/10 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-white/70">{pos}</span>
            )}
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Dismiss">
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto vocabify-fade-scroll px-3 py-1 max-h-[380px]">
        {errorMessage ? (
          <div className="my-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[12px] text-red-400">
            <p className="font-medium">AI explanation failed</p>
            <p className="mt-1 text-red-400/80">{errorMessage}</p>
            {onRetry && <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 h-7 text-[11px]">Retry</Button>}
          </div>
        ) : (
          <>
            {(senses && senses.length > 0) ? (
              <div className="space-y-1.5 py-1">
                {senses.map((sense, i) => (
                  <SenseRow key={i} index={i} sense={sense} streaming={streaming} />
                ))}
              </div>
            ) : streaming ? (
              <div className="space-y-1.5 py-1"><SenseSkeleton /></div>
            ) : null}
            {(mnemonic || streaming) && (
              <div className="mt-2 border-t border-white/8 pt-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">联想记忆</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/80">
                  {mnemonic || (streaming ? <Skeleton width={200} /> : null)}
                </p>
              </div>
            )}
            {savedRecord?.sourceUrl && (
              <p className="mt-2 truncate text-[10px] text-white/50">
                源: <a href={savedRecord.sourceUrl} target="_blank" rel="noreferrer" className="text-[#5b5bf8] hover:underline">{new URL(savedRecord.sourceUrl).hostname}</a>
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-white/8 px-2 py-1.5">
        {savedRecord ? (
          <SavedFooter savedRecord={savedRecord} onMark={onMark} onEnterEdit={onEnterEdit} onDelete={onDelete} />
        ) : (
          <NewWordFooter canSave={!streaming && !!record?.term && (record?.senses?.length || 0) > 0 && !errorMessage} onSave={onSave} onEnterEdit={onEnterEdit} streaming={streaming} />
        )}
      </div>
    </div>
  )
}

function SenseRow({ index, sense, streaming }: { index: number; sense: { definition?: string; example?: string; exampleTranslation?: string }; streaming?: boolean }) {
  const num = `①②③`[index] || `${index + 1}`
  return (
    <div className="rounded border border-white/8 bg-[#323232] px-2.5 py-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium text-[#5b5bf8]">{num}</span>
        <p className="text-[12px] leading-relaxed text-white/90">{sense.definition || (streaming ? <Skeleton width={140} /> : null)}</p>
      </div>
      {(sense.example || streaming) && (
        <p className="mt-1 text-[11px] italic leading-relaxed text-white/60">"{sense.example || (streaming ? <Skeleton width={180} /> : '')}"</p>
      )}
      {sense.exampleTranslation && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{sense.exampleTranslation}</p>
      )}
    </div>
  )
}

function SenseSkeleton() {
  return (
    <div className="rounded border border-white/8 bg-[#323232] px-2.5 py-1.5">
      <div className="vocabify-skeleton-breathe h-3.5 w-4/5 rounded" />
      <div className="vocabify-skeleton-breathe mt-2 h-3 w-full rounded" style={{ animationDelay: '0.08s' }} />
    </div>
  )
}

function Skeleton({ width = 80 }: { width?: number }) {
  return <span className="vocabify-skeleton-breathe inline-block h-3 rounded align-middle" style={{ width }} aria-hidden />
}

// ───────────────────────────── Footers ─────────────────────────────

function NewWordFooter({ canSave, onSave, onEnterEdit, streaming }: { canSave: boolean; onSave?: () => void; onEnterEdit?: () => void; streaming?: boolean }) {
  return (
    <div className="flex w-full items-center gap-1">
      <div className="flex-1" />
      <Button variant="ghost" size="icon-sm" onClick={onEnterEdit} disabled={streaming || !canSave} aria-label="Edit" title="Edit" className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white">
        <Edit3 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onSave} disabled={!canSave} className="h-7 rounded-md px-2.5 text-[12px] text-white/90 hover:bg-white/10 hover:text-white" data-testid="vocabify-save-action">
        <Plus className="h-3.5 w-3.5" />
        加入词库
      </Button>
    </div>
  )
}

function SavedFooter({ savedRecord, onMark, onEnterEdit, onDelete }: { savedRecord: VocabRecord; onMark?: (action: MarkAction) => void; onEnterEdit?: () => void; onDelete?: () => void }) {
  return (
    <>
      <LevelChip score={savedRecord.score} />
      <div className="flex-1" />
      <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white" onClick={() => onMark?.('KNOW')} data-testid="vocabify-mark-know">
        <Check className="h-3 w-3" /> Know
      </Button>
      <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white" onClick={() => onMark?.('FUZZY')} data-testid="vocabify-mark-fuzzy">
        <Brain className="h-3 w-3" /> Fuzzy
      </Button>
      <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white" onClick={() => onMark?.('FORGET')} data-testid="vocabify-mark-forget">
        <HelpCircle className="h-3 w-3" /> Forget
      </Button>
      <span className="mx-0.5 h-4 w-px bg-white/10" />
      <Button variant="ghost" size="icon-sm" onClick={onEnterEdit} aria-label="Edit" title="Edit" className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white">
        <Edit3 className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete" title="Delete" className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-red-400">
        <Trash2 className="h-3 w-3" />
      </Button>
    </>
  )
}

function LevelChip({ score }: { score: number }) {
  const level: FamiliarityLevel = score <= 0 ? 'NEW' : score <= 40 ? 'LEARNING' : score <= 70 ? 'FAMILIAR' : 'MASTERED'
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

function EditCard({ record, saving, onCommit, onCancel }: { record: Partial<VocabResponse> | VocabRecord; saving?: boolean; onCommit?: (fields: EditableFields) => void; onCancel?: () => void }) {
  return (
    <div className="max-h-[380px] overflow-y-auto vocabify-fade-scroll px-3 pt-2.5 pb-2">
      <RecordEditForm
        initial={{
          term: record.term || '',
          phonetic: record.phonetic || '',
          pos: (record.pos as EditableFields['pos']) || 'other',
          senses: (record.senses || []).map((s) => ({ definition: s.definition || '', example: s.example || '', exampleTranslation: s.exampleTranslation || '' })),
          mnemonic: record.mnemonic || '',
        }}
        saving={saving}
        onCommit={(fields) => onCommit?.(fields)}
        onCancel={() => onCancel?.()}
      />
    </div>
  )
}

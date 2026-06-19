import React from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  AlertCircle, Brain, Check, Copy, Edit3, Eye, HelpCircle,
  Plus, Search, Trash2, Volume2, X,
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
import { translationRevealMode, type TranslationRevealMode } from '@/utils/storage'

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
  retryInfo?: { attempt: number; maxRetries: number; error: string } | null
  hasReceivedChunk?: boolean

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

export interface SavedWordPopoverProps {
  open: boolean
  rect: SelectionRect | null
  portalContainer?: HTMLElement | null
  record?: Partial<VocabResponse> | VocabRecord
  savedRecord?: VocabRecord | null
  onDismiss: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onContentRectChange?: (rect: SelectionRect | null) => void
  onMark?: (action: MarkAction) => void
  onEnterEdit?: () => void
  onDelete?: () => void
  onSpeak?: () => void
}

export function SelectionPopover(props: SelectionPopoverProps) {
  const { open, rect, mode, portalContainer, onDismiss, onPointerEnter, onPointerLeave } = props
  if (!open || !rect) return null

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
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
          'p-0 shadow-none ring-0 focus-visible:outline-none',
          mode === 'operation-bar' && 'w-[196px]',
          mode === 'card' && 'w-[340px]',
          mode === 'edit' && 'w-[380px]',
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
            retryInfo={props.retryInfo}
            savedRecord={props.savedRecord}
            selectionText={props.selectionText}
            onSave={props.onSave}
            onMark={props.onMark}
            onEnterEdit={props.onEnterEdit}
            onDelete={props.onDelete}
            onRetry={props.onRetry}
            onSpeak={props.onSpeak}
            onDismiss={onDismiss}
            hasReceivedChunk={props.hasReceivedChunk}
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

export function SavedWordPopover({
  open,
  rect,
  portalContainer,
  record,
  savedRecord,
  onDismiss,
  onPointerEnter,
  onPointerLeave,
  onContentRectChange,
  onMark,
  onEnterEdit,
  onDelete,
  onSpeak,
}: SavedWordPopoverProps) {
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
        ref={(node) => {
          onContentRectChange?.(node ? rectToSelectionRect(node.getBoundingClientRect()) : null)
        }}
        className={cn(
          NO_SELECTION_CONTAINER,
          'w-[340px] p-0 shadow-none ring-0 focus-visible:outline-none',
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
        <div data-testid="vocabify-saved-hover-card">
          <Card
            record={record}
            savedRecord={savedRecord}
            onMark={onMark}
            onEnterEdit={onEnterEdit}
            onDelete={onDelete}
            onSpeak={onSpeak}
            onDismiss={onDismiss}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function rectToSelectionRect(rect: DOMRect): SelectionRect {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
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
    <div className="flex items-center gap-1 px-1.5 py-1">
      <span className="flex min-w-0 flex-1 items-center px-1.5 text-[12px] font-medium text-muted-foreground">
        <span className="truncate" title={text}>{text}</span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 rounded-[5px] px-2 text-[12px] text-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-3"
        onClick={onQuery}
        aria-label="Query"
        data-testid="vocabify-operation-query"
      >
        <Search />
        查询
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-3"
        onClick={onCopy}
        aria-label="Copy"
        title="Copy"
      >
        <Copy />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-3"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X />
      </Button>
    </div>
  )
}

// ───────────────────────────── Card ─────────────────────────────

function Card({
  record, streaming, errorMessage, savedRecord,
  selectionText,
  onSave, onMark, onEnterEdit, onDelete, onRetry, onSpeak, onDismiss,
  hasReceivedChunk, retryInfo,
}: {
  record?: Partial<VocabResponse> | VocabRecord
  streaming?: boolean
  errorMessage?: string | null
  retryInfo?: { attempt: number; maxRetries: number; error: string } | null
  savedRecord?: VocabRecord | null
  selectionText?: string
  onSave?: () => void
  onMark?: (action: MarkAction) => void
  onEnterEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
  onSpeak?: () => void
  onDismiss: () => void
  hasReceivedChunk?: boolean
}) {
  const term = record?.term
  const title = term || selectionText || ''
  const phonetic = record?.phonetic
  const pos = record?.pos
  const senses = record?.senses
  const mnemonic = record?.mnemonic
  const displaySenses = (senses || []).filter(hasSenseContent)
  const hasSenses = displaySenses.length > 0
  const isWaitingForModel = !!streaming && !hasReceivedChunk && !hasSenses
  const isBuildingResult = !!streaming && hasReceivedChunk && !hasSenses
  const showMnemonic = !!mnemonic
  const [translationMode, setTranslationMode] = React.useState<TranslationRevealMode>('hover')

  React.useEffect(() => {
    let mounted = true
    translationRevealMode.getValue().then((value) => {
      if (mounted) setTranslationMode(value)
    })
    const unwatch = translationRevealMode.watch((value) => setTranslationMode(value))
    return () => {
      mounted = false
      unwatch()
    }
  }, [])

  return (
    <div className="flex flex-col" data-testid="vocabify-selection-popover">
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <TermTitle text={title || '—'} />
            {onSpeak && (
              <Button variant="ghost" size="icon-sm" onClick={onSpeak} className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Pronounce" title="Pronounce">
                <Volume2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground" data-testid="vocabify-stream-phonetic">
              {phonetic || (streaming ? null : '—')}
            </span>
            {pos && (
              <span className="rounded bg-secondary px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid="vocabify-stream-pos">{pos}</span>
            )}
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Dismiss">
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto vocabify-fade-scroll px-3 py-1 max-h-[380px]">
        {errorMessage ? (
          <div className="my-2 rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[12px] text-red-300" data-testid="vocabify-stream-error">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-red-700 dark:text-red-100">Lookup failed</p>
                <p className="mt-1 break-words text-red-700 dark:text-red-100/70">{errorMessage}</p>
              </div>
            </div>
            {onRetry && <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 h-7 border-red-500/25 bg-transparent text-[11px] text-red-700 dark:text-red-100 hover:bg-red-500/10">Retry now</Button>}
          </div>
        ) : (
          <>
            {retryInfo && (
              <div className="py-1.5" data-testid="vocabify-stream-retrying">
                <div className="inline-flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-ai-pulse" />
                  Retrying {retryInfo.attempt}/{retryInfo.maxRetries}
                </div>
              </div>
            )}
            {isWaitingForModel && (
              <div className="py-1.5" data-testid="vocabify-stream-waiting">
                <span className="block h-1 w-12 rounded-full bg-primary/70 animate-ai-pulse" aria-label="Loading explanation" />
              </div>
            )}
            {hasSenses ? (
              <div className="space-y-1.5 py-1" data-testid="vocabify-stream-senses">
                {displaySenses.map((sense, i) => (
                  <SenseRow key={i} index={i} sense={sense} streaming={streaming} translationMode={translationMode} />
                ))}
              </div>
            ) : isBuildingResult ? (
              <div className="py-1.5" data-testid="vocabify-stream-building">
                <div className="inline-flex items-center gap-2 rounded border border-border/60 bg-card px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-ai-pulse" />
                  Structuring definition
                </div>
              </div>
            ) : null}
            {showMnemonic && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">联想记忆</p>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/85" data-testid="vocabify-stream-mnemonic">
                  {mnemonic || (streaming ? <Skeleton width={200} /> : null)}
                </p>
              </div>
            )}
            {savedRecord?.sourceUrl && (
              <p className="mt-2 truncate text-[10px] text-muted-foreground">
                源: <a href={savedRecord.sourceUrl} target="_blank" rel="noreferrer" className="text-[#5b5bf8] hover:underline">{new URL(savedRecord.sourceUrl).hostname}</a>
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
        {savedRecord ? (
          <SavedFooter savedRecord={savedRecord} onMark={onMark} onEnterEdit={onEnterEdit} onDelete={onDelete} />
        ) : (
          <NewWordFooter canSave={!streaming && !!record?.term && hasSenses && !errorMessage} onSave={onSave} onEnterEdit={onEnterEdit} streaming={streaming} />
        )}
      </div>
    </div>
  )
}

function SenseRow({
  index,
  sense,
  streaming,
  translationMode,
}: {
  index: number
  sense: { definition?: string; example?: string; exampleTranslation?: string }
  streaming?: boolean
  translationMode: TranslationRevealMode
}) {
  const num = `①②③`[index] || `${index + 1}`
  const [revealed, setRevealed] = React.useState(false)
  const showTranslation = translationMode === 'always' || revealed
  return (
    <div className="rounded border border-border/60 bg-card px-2.5 py-1.5 animate-fade-in">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium text-primary">{num}</span>
        <p className="text-[12px] leading-relaxed text-foreground" data-testid="vocabify-stream-definition">{sense.definition || (streaming ? <Skeleton width={140} /> : null)}</p>
      </div>
      {(sense.example || streaming) && (
        <p className="mt-1 text-[11px] italic leading-relaxed text-muted-foreground" data-testid="vocabify-stream-example">"{sense.example || (streaming ? <Skeleton width={180} /> : '')}"</p>
      )}
      {sense.exampleTranslation && (
        <div className="mt-0.5 flex items-start gap-1.5">
          {translationMode === 'hover' && (
            <button
              type="button"
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Reveal translation"
              onMouseEnter={() => setRevealed(true)}
              onMouseLeave={() => setRevealed(false)}
              onFocus={() => setRevealed(true)}
              onBlur={() => setRevealed(false)}
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
          <p
            className={cn(
              'min-w-0 text-[11px] leading-relaxed text-muted-foreground transition-all',
              translationMode === 'hover' && !showTranslation && 'select-none blur-[3px] opacity-45',
            )}
            data-testid="vocabify-stream-translation"
            aria-hidden={translationMode === 'hover' && !showTranslation}
          >
            {sense.exampleTranslation}
          </p>
        </div>
      )}
    </div>
  )
}

function hasSenseContent(sense: { definition?: string; example?: string; exampleTranslation?: string }) {
  return !!(sense.definition || sense.example || sense.exampleTranslation)
}

function TermTitle({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false)
  const canExpand = text.length > 34

  return (
    <div className="min-w-0 flex-1">
      <h2
        className={cn(
          'font-display font-semibold tracking-tight text-foreground break-words',
          getTermTitleSize(text),
          !expanded && 'vocabify-line-clamp-2',
        )}
        data-testid="vocabify-stream-term"
        title={text}
      >
        {text}
      </h2>
      {canExpand && (
        <button
          type="button"
          className="mt-0.5 text-[10px] font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? 'Collapse' : 'Show all'}
        </button>
      )}
    </div>
  )
}

function getTermTitleSize(text: string) {
  if (text.length > 80) return 'text-[12px] leading-[1.35]'
  if (text.length > 48) return 'text-[13px] leading-[1.35]'
  if (text.length > 24) return 'text-[14px] leading-[1.3]'
  return 'text-[17px] leading-[1.2]'
}

function SenseSkeleton({ active = false }: { active?: boolean }) {
  return (
    <div className="rounded border border-border/60 bg-card px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <div className="vocabify-skeleton-breathe h-3.5 w-4/5 rounded" />
        {active && <span className="h-3 w-px bg-primary/80 animate-ai-pulse" aria-hidden />}
      </div>
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
      <Button variant="ghost" size="icon-sm" onClick={onEnterEdit} disabled={streaming || !canSave} aria-label="Edit" title="Edit" className="h-7 w-7 text-muted-foreground hover:bg-secondary hover:text-foreground">
        <Edit3 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onSave} disabled={!canSave} className="h-7 rounded-md px-2.5 text-[12px] text-foreground hover:bg-secondary hover:text-foreground" data-testid="vocabify-save-action">
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
      <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[11px] text-foreground/85 hover:bg-secondary hover:text-foreground" onClick={() => onMark?.('KNOW')} data-testid="vocabify-mark-know">
        <Check className="h-3 w-3" /> Know
      </Button>
      <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[11px] text-foreground/85 hover:bg-secondary hover:text-foreground" onClick={() => onMark?.('FUZZY')} data-testid="vocabify-mark-fuzzy">
        <Brain className="h-3 w-3" /> Fuzzy
      </Button>
      <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[11px] text-foreground/85 hover:bg-secondary hover:text-foreground" onClick={() => onMark?.('FORGET')} data-testid="vocabify-mark-forget">
        <HelpCircle className="h-3 w-3" /> Forget
      </Button>
      <span className="mx-0.5 h-4 w-px bg-secondary" />
      <Button variant="ghost" size="icon-sm" onClick={onEnterEdit} aria-label="Edit" title="Edit" className="h-7 w-7 text-muted-foreground hover:bg-secondary hover:text-foreground">
        <Edit3 className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete" title="Delete" className="h-7 w-7 text-muted-foreground hover:bg-secondary hover:text-red-400">
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
    <div className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <span className={`vocabify-level-dot is-${suffix}`} aria-hidden />
      <span className="text-muted-foreground">{meta.label}</span>
      <span className="tabular text-foreground/85">{score}</span>
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

import React, { useRef, useState, useEffect } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { VocabResponse } from '@/lib/aiSchema'
import type { VocabRecord } from '@/lib/vocabTypes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertCircle, ArrowLeft, BookOpen, CheckCircle2, Copy, Edit3, ExternalLink, Github,
  Loader2, LoaderCircle, LogOut, RefreshCw, Search, Trash2, Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  disconnectGitHubSync,
  pollGitHubDeviceToken,
  startGitHubDeviceFlow,
  syncVocabularyWithGitHub,
  type GitHubDeviceFlow,
} from '@/lib/githubSync'
import { githubAccessToken, githubLastSyncAt, githubSyncAccount, type GithubSyncAccount } from '@/utils/storage'
import { getLevel, levelClassSuffix } from '@/lib/familiarity'
import { RecordEditForm, type EditableFields } from '@/components/RecordEditForm'
import { countRecords, deleteRecordById, getAllRecords, searchRecords, updateRecordFields } from '@/lib/vocabApi'
import { FamiliarityMeter, MemoryCurvePanel } from '@/components/FamiliarityMeter'
import { AIThinkingBlock, getStreamCharacterState } from '@/components/AIThinkingBlock'
import type { RuntimeMessage } from '@/lib/messaging'
import { useAIStream } from '@/lib/aiStreamClient'
import { responseToRecordPatch } from '@/lib/vocabTypes'
import { speakText } from '@/lib/speech'

const WORDLIST_EDIT_FORM_ID = 'vocabify-wordlist-edit-form'
type SpeakHandler = () => void | Promise<void>
type SpeakTextHandler = (text: string) => void | Promise<void>

function useVocabularyCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const next = await countRecords()
        if (!cancelled) setCount(next)
      } catch (error) {
        console.error('Failed to load vocabulary count:', error)
      }
    }
    void load()
    const handler = (message: RuntimeMessage) => {
      if (message.type === 'vocabChanged') void load()
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(handler)
    }
  }, [])
  return count
}

export function VocabList() {
  const [records, setRecords] = useState<VocabRecord[]>([])
  const totalRecords = useVocabularyCount()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [expandedCurveId, setExpandedCurveId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [redefiningId, setRedefiningId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const skipNextVocabChangedRef = useRef(false)
  const aiStream = useAIStream()
  const editingRecord = editingId == null ? null : records.find((record) => record.id === editingId) ?? null
  const isRedefining = aiStream.status === 'loading' || aiStream.status === 'streaming'
  const redefiningStatusLabel = aiStream.hasReceivedReasoning ? 'Thinking' : 'Loading'

  useEffect(() => { loadRecords() }, [])

  async function loadRecords() {
    setLoading(true)
    try {
      const allRecords = await getAllRecords()
      setRecords(allRecords)
    } catch (error) {
      console.error('Failed to load records:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchKeyword.trim()) {
      loadRecords()
      return
    }
    setLoading(true)
    try {
      const results = await searchRecords(searchKeyword)
      setRecords(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(handleSearch, 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword])

  useEffect(() => {
    const handler = (message: RuntimeMessage) => {
      if (message.type !== 'vocabChanged') return
      if (skipNextVocabChangedRef.current) {
        skipNextVocabChangedRef.current = false
        return
      }
      void handleSearch()
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword])

  async function handleDelete(id: number) {
    try {
      skipNextVocabChangedRef.current = true
      await deleteRecordById(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (error) {
      skipNextVocabChangedRef.current = false
      console.error('Delete failed:', error)
    }
  }

  async function handleEditCommit(id: number, fields: EditableFields) {
    setSaving(true)
    try {
      await updateRecordFields(id, {
        term: fields.term,
        phonetic: fields.phonetic,
        pos: fields.pos,
        senses: fields.senses.map((s, i) => ({ id: `s${i + 1}`, ...s })),
        mnemonic: fields.mnemonic,
      })
      setEditingId(null)
      await loadRecords()
    } catch (e) {
      console.error('Edit failed:', e)
    } finally {
      setSaving(false)
    }
  }

  function handleRedefine(record: VocabRecord) {
    if (!record.id || isRedefining) return
    setRedefiningId(record.id)
    setExpanded(record.id)
    aiStream.start(record.term || record.wordOrPhrase, record.sourceContext)
  }

  useEffect(() => {
    if (!redefiningId || !aiStream.final) return

    let cancelled = false
    async function persistRedefinition() {
      await updateRecordFields(redefiningId!, responseToRecordPatch(aiStream.final!))
      if (cancelled) return
      await handleSearch()
      if (!cancelled) setRedefiningId(null)
    }

    void persistRedefinition().catch((error) => {
      if (cancelled) return
      console.error('Redefine failed:', error)
      setRedefiningId(null)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redefiningId, aiStream.final])

  useEffect(() => {
    return () => aiStream.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getDisplayRecord(record: VocabRecord): VocabRecord | Partial<VocabResponse> {
    if (record.id !== redefiningId || aiStream.status === 'error') return record
    return {
      term: aiStream.partial.term || record.term,
      phonetic: aiStream.partial.phonetic || '',
      pos: aiStream.partial.pos || record.pos,
      senses: aiStream.partial.senses || [],
      mnemonic: aiStream.partial.mnemonic || '',
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden">
      <GitHubSyncControl recordCount={totalRecords} onSynced={loadRecords} />

      {editingRecord ? (
        <WordlistEditPanel
          key={editingRecord.id}
          record={editingRecord}
          saving={saving}
          onBack={() => setEditingId(null)}
          onCommit={(fields) => editingRecord.id && handleEditCommit(editingRecord.id, fields)}
        />
      ) : (
        <>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search vocabulary"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-8 pl-8 text-[12px] focus-visible:ring-inset"
              aria-label="Search vocabulary"
            />
          </div>

          {loading ? (
            <div className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
              <ListSkeleton />
            </div>
          ) : records.length === 0 ? (
            <div
              className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto px-1.5 py-1"
              data-testid="vocabify-wordlist-scroll"
            >
              <EmptyState hasFilter={!!searchKeyword.trim()} />
            </div>
          ) : (
            <Virtuoso
              className="vocabify-fade-scroll min-h-0 flex-1"
              data-testid="vocabify-wordlist-scroll"
              data={records}
              increaseViewportBy={{ top: 320, bottom: 640 }}
              computeItemKey={(_, record) => record.id ?? record.wordOrPhrase}
              itemContent={(index, record) => (
                <div className={cn('px-1.5 pb-1.5', index === 0 && 'pt-1')}>
                  <WordlistItem
                    record={record}
                    displayRecord={getDisplayRecord(record)}
                    expanded={expanded === record.id}
                    curveExpanded={expandedCurveId === record.id}
                    redefining={redefiningId === record.id}
                    streaming={isRedefining}
                    streamStatusLabel={redefiningStatusLabel}
                    streamError={redefiningId === record.id && aiStream.status === 'error' ? aiStream.error : null}
                    hasReceivedChunk={aiStream.hasReceivedChunk}
                    hasReceivedReasoning={aiStream.hasReceivedReasoning}
                    onToggleExpanded={() => setExpanded(expanded === record.id ? null : record.id ?? null)}
                    onRedefine={() => handleRedefine(record)}
                    onSpeak={() => speakText(record.term || record.wordOrPhrase)}
                    onSpeakText={(text) => speakText(text)}
                    onEdit={() => setEditingId(record.id ?? null)}
                    onDelete={() => record.id && handleDelete(record.id)}
                    onCurveExpandedChange={(next) => setExpandedCurveId(next ? record.id ?? null : null)}
                  />
                </div>
              )}
            />
          )}
        </>
      )}
    </div>
  )
}

function WordlistItem({
  record,
  displayRecord,
  expanded,
  curveExpanded,
  redefining,
  streaming,
  streamStatusLabel,
  streamError,
  hasReceivedChunk,
  hasReceivedReasoning,
  onToggleExpanded,
  onRedefine,
  onSpeak,
  onSpeakText,
  onEdit,
  onDelete,
  onCurveExpandedChange,
}: {
  record: VocabRecord
  displayRecord: VocabRecord | Partial<VocabResponse>
  expanded: boolean
  curveExpanded: boolean
  redefining: boolean
  streaming: boolean
  streamStatusLabel: string
  streamError: string | null
  hasReceivedChunk: boolean
  hasReceivedReasoning: boolean
  onToggleExpanded: () => void
  onRedefine: () => void
  onSpeak: SpeakHandler
  onSpeakText: SpeakTextHandler
  onEdit: () => void
  onDelete: () => void
  onCurveExpandedChange: (next: boolean) => void
}) {
  const level = getLevel(record.score)
  const levelSuffix = levelClassSuffix(level)
  const itemIsStreaming = redefining && streaming
  const isPhrase = displayRecord.pos === 'phrase'
  const phraseTranslation = displayRecord.senses?.[0]?.definition || ''
  const hasSenses = !!displayRecord.senses?.length
  const [speaking, setSpeaking] = useState(false)
  const [speakingExampleKey, setSpeakingExampleKey] = useState<string | null>(null)
  const itemCharacterState = getStreamCharacterState({
    streaming: itemIsStreaming,
    hasReceivedChunk,
    hasReceivedReasoning,
    hasSenses,
  })

  async function handleSpeakClick(event: React.MouseEvent) {
    event.stopPropagation()
    if (speaking) return
    setSpeaking(true)
    try {
      await onSpeak()
    } finally {
      setSpeaking(false)
    }
  }

  async function handleExampleSpeak(event: React.MouseEvent, text: string, key: string) {
    event.stopPropagation()
    if (speakingExampleKey) return
    setSpeakingExampleKey(key)
    try {
      await onSpeakText(text)
    } finally {
      setSpeakingExampleKey(null)
    }
  }

  return (
    <div
      className={cn(
        'rounded-[8px] border border-border bg-card transition-colors animate-fade-in',
        'hover:border-primary/45 dark:border-white/[0.04] dark:hover:border-primary/30',
        expanded && 'border-primary/45 dark:border-primary/30',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onToggleExpanded()
        }}
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`vocabify-level-dot is-${levelSuffix} shrink-0`} aria-hidden />
            <h3 className="truncate font-display text-[14px] font-semibold tracking-tight">
              {record.term || record.wordOrPhrase}
            </h3>
            {record.pos && !isPhrase && (
              <span className="rounded-[3px] bg-secondary px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-foreground/80">
                {record.pos}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onRedefine() }}
              disabled={streaming}
              aria-label={`Redefine ${record.wordOrPhrase}`}
              title="Redefine"
              className="ml-auto h-6 w-6 text-muted-foreground hover:text-foreground"
              data-testid="vocabify-wordlist-redefine"
            >
              <RefreshCw className={cn('h-3 w-3', itemIsStreaming && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => void handleSpeakClick(e)}
              disabled={speaking}
              aria-label="Pronounce"
              title="Pronounce"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              {speaking ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              aria-label={`Edit ${record.wordOrPhrase}`}
              title="Edit"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            <InlineDeleteConfirm
              label={record.term || record.wordOrPhrase}
              onConfirm={onDelete}
              triggerClassName="h-6 w-6 text-muted-foreground hover:text-destructive"
            />
          </div>
          {displayRecord.phonetic && !isPhrase && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{displayRecord.phonetic}</p>
          )}
          {expanded ? (
            <div className="mt-1 space-y-2">
              {streamError ? (
                <div className="rounded-[5px] bg-destructive/10 px-2 py-1.5 text-[11px] leading-relaxed text-destructive">
                  {streamError}
                </div>
              ) : itemIsStreaming && !hasSenses ? (
                <div className="py-1">
                  <AIThinkingBlock label={streamStatusLabel} state={itemCharacterState} compact />
                </div>
              ) : isPhrase ? (
                <div className="rounded-[5px] bg-secondary/40 px-2 py-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Translation</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">{phraseTranslation}</p>
                </div>
              ) : (
                (displayRecord.senses || []).map((sense, i) => (
                  <div key={(sense as { id?: string }).id || i} className="rounded-[5px] bg-secondary/40 px-2 py-1.5">
                    <p className="text-[12px] leading-relaxed text-foreground">
                      <span className="text-primary mr-1">{`①②③`[i] || i + 1}</span>
                      {sense.definition}
                    </p>
                    {sense.example && (
                      <div className="mt-0.5 flex items-start gap-1.5">
                        <p className="min-w-0 flex-1 text-[11px] italic text-muted-foreground">"{sense.example}"</p>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(event) => {
                            void handleExampleSpeak(
                              event,
                              sense.example || '',
                              `${(sense as { id?: string }).id || i}`,
                            )
                          }}
                          disabled={!!speakingExampleKey}
                          aria-label="Pronounce example"
                          title="Pronounce example"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        >
                          {speakingExampleKey === `${(sense as { id?: string }).id || i}` ? (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                    {sense.exampleTranslation && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80">{sense.exampleTranslation}</p>
                    )}
                  </div>
                ))
              )}
              {displayRecord.mnemonic && !isPhrase && (
                <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground/80">联想: </span>{displayRecord.mnemonic}</p>
              )}
              {record.sourceUrl && (
                <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-[10px] text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  源: {new URL(record.sourceUrl).hostname}
                </a>
              )}
            </div>
          ) : (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
              {phraseTranslation}
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="tabular text-[10px] text-muted-foreground/70">
              {new Date(record.updatedAt).toLocaleDateString()}
            </p>
            <FamiliarityMeter
              record={record}
              align="right"
              expanded={curveExpanded}
              onExpandedChange={onCurveExpandedChange}
              renderCurve={false}
            />
          </div>
          {curveExpanded ? (
            <div className="mt-1.5 flex justify-end">
              <MemoryCurvePanel record={record} className="w-[280px]" hideTitle />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InlineDeleteConfirm({
  label,
  onConfirm,
  triggerClassName,
}: {
  label: string
  onConfirm: () => void | Promise<void>
  triggerClassName?: string
}) {
  const [open, setOpen] = React.useState(false)

  async function confirmDelete(event: React.MouseEvent) {
    event.stopPropagation()
    await onConfirm()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Delete ${label}`}
          title="Delete"
          className={triggerClassName}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        className="w-[220px] border-border/80 bg-background p-2.5 shadow-[0_14px_36px_rgb(0_0_0_/_0.18)] dark:border-white/[0.14] dark:bg-[#34343a] dark:shadow-[0_18px_44px_rgb(0_0_0_/_0.38)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[12px] font-medium text-foreground">Delete this entry?</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          Remove “{label}” from your wordlist.
        </p>
        <div className="mt-2 flex justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={(event) => {
              event.stopPropagation()
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={(event) => void confirmDelete(event)}
          >
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function WordlistEditPanel({
  record,
  saving,
  onBack,
  onCommit,
}: {
  record: VocabRecord
  saving: boolean
  onBack: () => void
  onCommit: (fields: EditableFields) => void
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border/60 bg-card dark:border-white/[0.04]">
      <div className="flex items-start gap-2 border-b border-border/50 px-3 py-2.5 dark:border-white/[0.04]">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          disabled={saving}
          aria-label="Back to wordlist"
          className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Edit entry</p>
          <h3 className="truncate font-display text-[14px] font-semibold tracking-tight">
            {record.term || record.wordOrPhrase}
          </h3>
        </div>
      </div>
      <div
        className="scrollbar-thin h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        data-testid="vocabify-wordlist-edit-scroll"
      >
        <RecordEditForm
          formId={WORDLIST_EDIT_FORM_ID}
          hideActions
          initial={{
            term: record.term,
            phonetic: record.phonetic,
            pos: record.pos,
            senses: record.senses,
            mnemonic: record.mnemonic,
          }}
          saving={saving}
          onCommit={onCommit}
          onCancel={onBack}
        />
      </div>
      <div className="shrink-0 border-t border-border/50 bg-card px-3 py-2.5 dark:border-white/[0.04]">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={saving}
            className="h-7 px-3 text-[12px]"
          >
            取消
          </Button>
          <Button
            type="submit"
            form={WORDLIST_EDIT_FORM_ID}
            variant="default"
            size="sm"
            disabled={saving}
            className="h-7 px-3 text-[12px]"
          >
            {saving ? '…' : '保存'}
          </Button>
        </div>
      </div>
    </section>
  )
}

const ListSkeleton = () => (
  <ul className="space-y-1.5" aria-label="Loading vocabulary">
    {Array.from({ length: 4 }).map((_, i) => (
      <li key={i} className="rounded-[8px] border border-border bg-card p-3 dark:border-white/[0.04]">
        <div className="vocabify-skeleton-breathe h-3.5 w-1/3 rounded" />
        <div className="vocabify-skeleton-breathe mt-2 h-3 w-full rounded" />
        <div className="vocabify-skeleton-breathe mt-1.5 h-3 w-4/5 rounded" />
      </li>
    ))}
  </ul>
)

function GitHubSyncControl({ recordCount, onSynced }: { recordCount: number; onSynced: () => Promise<void> }) {
  const [token, setToken] = useState<string | null>(null)
  const [account, setAccount] = useState<GithubSyncAccount | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [deviceFlow, setDeviceFlow] = useState<GitHubDeviceFlow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const authAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([
      githubAccessToken.getValue(),
      githubSyncAccount.getValue(),
      githubLastSyncAt.getValue(),
    ]).then(([storedToken, storedAccount, storedLastSyncAt]) => {
      if (!mounted) return
      setToken(storedToken)
      setAccount(storedAccount)
      setLastSyncAt(storedLastSyncAt)
    })
    return () => { mounted = false }
  }, [])

  async function syncWithToken(nextToken: string) {
    const result = await syncVocabularyWithGitHub(nextToken)
    setToken(nextToken)
    setAccount(result.account)
    setLastSyncAt(result.syncedAt)
    await onSynced()
    return result
  }

  async function handleConnect() {
    setLoading(true); setError(''); setCopied(false)
    try {
      const abortController = new AbortController()
      authAbortRef.current = abortController
      const flow = await startGitHubDeviceFlow()
      setDeviceFlow(flow)
      window.open(flow.verification_uri, '_blank', 'noopener,noreferrer')
      const nextToken = await pollGitHubDeviceToken(flow, undefined, abortController.signal)
      await syncWithToken(nextToken)
      setDeviceFlow(null)
    } catch (syncError) {
      if (!(syncError instanceof DOMException && syncError.name === 'AbortError')) {
        setError(syncError instanceof Error ? syncError.message : String(syncError))
      }
    } finally {
      authAbortRef.current = null
      setLoading(false)
    }
  }

  async function handleSync() {
    if (!token) { await handleConnect(); return }
    setLoading(true); setError('')
    try { await syncWithToken(token) } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError))
    } finally { setLoading(false) }
  }

  async function handleDisconnect() {
    authAbortRef.current?.abort()
    await disconnectGitHubSync()
    setToken(null); setAccount(null); setLastSyncAt(null); setDeviceFlow(null); setError('')
  }

  async function copyCode() {
    if (!deviceFlow?.user_code) return
    await navigator.clipboard?.writeText(deviceFlow.user_code).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function cancelDeviceFlow() {
    authAbortRef.current?.abort()
    setDeviceFlow(null)
    setLoading(false)
  }

  const connected = Boolean(token && account)

  return (
    <section
      className="shrink-0 rounded-[8px] border border-border bg-card px-2.5 py-2 dark:border-white/[0.04]"
      data-testid="vocabify-github-sync"
      aria-label="GitHub vocabulary sync"
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground/80', connected && 'text-primary')}>
          <Github className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {connected ? (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
            ) : error ? (
              <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
            ) : (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            )}
            <p className="truncate text-[12px] font-medium leading-4">
              {connected ? `GitHub · ${account?.login}` : 'GitHub sync'}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
            {error
              ? error
              : lastSyncAt
                ? `${recordCount} words · synced ${formatRelativeTime(lastSyncAt)}`
                : `${recordCount} words · private repo sync`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={connected ? handleSync : handleConnect}
            disabled={loading}
            className="h-7 rounded-[6px] px-2 text-[11px]"
            data-testid="vocabify-github-sync-action"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : connected ? <RefreshCw className="h-3 w-3" /> : <Github className="h-3 w-3" />}
            {connected ? 'Sync' : 'Connect'}
          </Button>
          {connected ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDisconnect}
              disabled={loading}
              aria-label="Disconnect"
              title="Disconnect"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </div>

      {deviceFlow ? (
        <div className="mt-2 rounded-[6px] border border-border bg-secondary px-2.5 py-2 text-[11px] leading-4 text-muted-foreground dark:border-white/[0.04]" data-testid="vocabify-github-device-flow">
          <div className="flex items-center justify-between gap-2">
            <span>Enter this code on GitHub</span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" onClick={() => window.open(deviceFlow.verification_uri, '_blank', 'noopener,noreferrer')} className="h-6 px-1.5 text-[10px]">
                Open<ExternalLink className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelDeviceFlow} className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive">
                Cancel
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="mt-1 flex w-full items-center justify-between rounded-[4px] border border-border bg-card px-2 py-1.5 font-mono text-[14px] font-semibold tracking-[0.16em] text-foreground transition-colors hover:bg-secondary dark:border-white/[0.04]"
            aria-label="Copy GitHub device code"
          >
            {deviceFlow.user_code}
            <span className="flex items-center gap-1 font-sans text-[10px] font-medium tracking-normal text-muted-foreground">
              <Copy className="h-3 w-3" />
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>
      ) : null}
    </section>
  )
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 'recently'
  const diff = Date.now() - time
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}

const EmptyState = ({ hasFilter }: { hasFilter: boolean }) => (
  <div className="flex h-full flex-col items-start justify-center gap-1.5 px-2 py-12">
    <BookOpen className="h-4 w-4 text-muted-foreground" />
    <p className="text-[13px] font-medium">{hasFilter ? 'No matching words' : 'Your vocabulary is empty'}</p>
    <p className="max-w-[260px] text-[12px] leading-relaxed text-muted-foreground">
      {hasFilter
        ? 'Try a different keyword or clear the search.'
        : 'Highlight any word on a page and choose Explain to save it here.'}
    </p>
  </div>
)

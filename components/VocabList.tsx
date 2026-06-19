import React, { useRef, useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db, deleteRecordById, updateRecordFields, type VocabRecord } from '@/lib/vocabifyDb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertCircle, BookOpen, CheckCircle2, Copy, Edit3, ExternalLink, Github,
  Loader2, LogOut, RefreshCw, Search, Trash2, Volume2,
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
import { FAMILIARITY_LEVELS, getLevel, levelClassSuffix } from '@/lib/familiarity'
import { RecordEditForm, type EditableFields } from '@/components/RecordEditForm'

function useVocabularyCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const subscription = liveQuery(() => db.records.count()).subscribe({
      next: setCount,
      error: (error) => console.error('Failed to watch vocabulary count:', error),
    })
    return () => subscription.unsubscribe()
  }, [])
  return count
}

export function VocabList() {
  const [records, setRecords] = useState<VocabRecord[]>([])
  const totalRecords = useVocabularyCount()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { loadRecords() }, [])

  async function loadRecords() {
    setLoading(true)
    try {
      const allRecords = await db.records.orderBy('updatedAt').reverse().toArray()
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
      const lowerKeyword = searchKeyword.toLowerCase()
      const results = await db.records
        .filter((r) =>
          r.wordOrPhrase.toLowerCase().includes(lowerKeyword) ||
          (r.term?.toLowerCase().includes(lowerKeyword) ?? false) ||
          (r.senses?.some((s) => s.definition.toLowerCase().includes(lowerKeyword)) ?? false),
        )
        .toArray()
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

  async function handleDelete(id: number) {
    try {
      await deleteRecordById(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  function speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch (e) {
      console.error('TTS failed:', e)
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <GitHubSyncControl recordCount={totalRecords} onSynced={loadRecords} />

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

      <div
        ref={listRef}
        className="vocabify-fade-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1"
        data-testid="vocabify-wordlist-scroll"
        onWheelCapture={(event) => {
          const scrollNode = listRef.current
          if (!scrollNode) return
          if (scrollNode.scrollHeight <= scrollNode.clientHeight) return
          event.preventDefault()
          scrollNode.scrollTop += event.deltaY
          event.stopPropagation()
        }}
      >
        {loading ? (
          <ListSkeleton />
        ) : records.length === 0 ? (
          <EmptyState hasFilter={!!searchKeyword.trim()} />
        ) : (
          <ul className="space-y-1.5">
            {records.map((record) => {
              const isExpanded = expanded === record.id
              const level = getLevel(record.score)
              const levelSuffix = levelClassSuffix(level)
              return (
                <li
                  key={record.id}
                  className={cn(
                    'rounded-[8px] border border-border bg-card transition-colors animate-fade-in',
                    'hover:bg-secondary/40 dark:border-white/[0.04]',
                    isExpanded && 'bg-secondary/40',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : record.id ?? null)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`vocabify-level-dot is-${levelSuffix} shrink-0`} aria-hidden />
                        <h3 className="truncate font-display text-[14px] font-semibold tracking-tight">
                          {record.term || record.wordOrPhrase}
                        </h3>
                        {record.pos && (
                          <span className="rounded-[3px] bg-secondary px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-foreground/80">
                            {record.pos}
                          </span>
                        )}
                        <span className="tabular shrink-0 text-[10px] text-muted-foreground">
                          {FAMILIARITY_LEVELS[level].label} · {record.score}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); speak(record.term || record.wordOrPhrase) }}
                          aria-label="Pronounce"
                          title="Pronounce"
                          className="ml-auto h-6 w-6 text-muted-foreground hover:text-foreground"
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {record.phonetic && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{record.phonetic}</p>
                      )}
                      {isExpanded ? (
                        editingId === record.id ? (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <RecordEditForm
                              initial={{
                                term: record.term,
                                phonetic: record.phonetic,
                                pos: record.pos,
                                senses: record.senses,
                                mnemonic: record.mnemonic,
                              }}
                              saving={saving}
                              onCommit={(fields) => record.id && handleEditCommit(record.id, fields)}
                              onCancel={() => setEditingId(null)}
                            />
                          </div>
                        ) : (
                          <div className="mt-1 space-y-2">
                            {record.senses.map((sense, i) => (
                              <div key={sense.id} className="rounded-[5px] bg-secondary/40 px-2 py-1.5">
                                <p className="text-[12px] leading-relaxed text-foreground">
                                  <span className="text-primary mr-1">{`①②③`[i] || i + 1}</span>
                                  {sense.definition}
                                </p>
                                {sense.example && (
                                  <p className="mt-0.5 text-[11px] italic text-muted-foreground">"{sense.example}"</p>
                                )}
                                {sense.exampleTranslation && (
                                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">{sense.exampleTranslation}</p>
                                )}
                              </div>
                            ))}
                            {record.mnemonic && (
                              <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground/80">联想: </span>{record.mnemonic}</p>
                            )}
                            {record.sourceUrl && (
                              <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-[10px] text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                源: {new URL(record.sourceUrl).hostname}
                              </a>
                            )}
                          </div>
                        )
                      ) : (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                          {record.senses?.[0]?.definition || ''}
                        </p>
                      )}
                      <p className="mt-1.5 tabular text-[10px] text-muted-foreground/70">
                        {new Date(record.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => { e.stopPropagation(); setEditingId(record.id ?? null); setExpanded(record.id ?? null) }}
                        aria-label={`Edit ${record.wordOrPhrase}`}
                        title="Edit"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => { e.stopPropagation(); if (record.id) handleDelete(record.id) }}
                        aria-label={`Delete ${record.wordOrPhrase}`}
                        title="Delete"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
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

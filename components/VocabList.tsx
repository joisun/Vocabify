import React, { useRef, useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db, deleteRecordById, type VocabRecord } from '@/lib/vocabifyDb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, BookOpen, CheckCircle2, Copy, ExternalLink, Github, Loader2, LogOut, RefreshCw, Search, Trash2, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  disconnectGitHubSync,
  pollGitHubDeviceToken,
  startGitHubDeviceFlow,
  syncVocabularyWithGitHub,
  type GitHubDeviceFlow,
} from '@/lib/githubSync'
import { githubAccessToken, githubLastSyncAt, githubSyncAccount, type GithubSyncAccount } from '@/utils/storage'

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
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    loadRecords()
  }, [])

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
        .filter((r) => r.wordOrPhrase.toLowerCase().includes(lowerKeyword))
        .toArray()
      setRecords(results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Live search as user types (debounced)
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <GitHubSyncControl recordCount={totalRecords} onSynced={loadRecords} />

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search vocabulary"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="liquid-glass-input h-9 pl-9"
          aria-label="Search vocabulary"
        />
      </div>

      {/* List */}
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
          <ul className="space-y-2">
            {records.map((record) => {
              const isExpanded = expanded === record.id
              return (
                <li
                  key={record.id}
                  className={cn(
                    "liquid-glass-card rounded-xl text-card-foreground",
                    "transition-[transform,box-shadow,background-color] duration-150 ease-spring hover:-translate-y-0.5",
                    "animate-fade-in"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : record.id ?? null)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-[15px] font-semibold tracking-tight truncate">
                          {record.wordOrPhrase}
                        </h3>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            speak(record.wordOrPhrase)
                          }}
                          aria-label="Pronounce"
                          title="Pronounce"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p
                        className={cn(
                          "mt-1 text-[13px] leading-relaxed text-muted-foreground",
                          !isExpanded && "line-clamp-2"
                        )}
                      >
                        {record.meaning}
                      </p>
                      <p className="mt-2 tabular text-[11px] text-muted-foreground/80">
                        {new Date(record.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (record.id) handleDelete(record.id)
                      }}
                      aria-label={`Delete ${record.wordOrPhrase}`}
                      title="Delete"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
  <ul className="space-y-2" aria-label="Loading vocabulary">
    {Array.from({ length: 4 }).map((_, i) => (
      <li
        key={i}
        className="rounded-xl border border-border/60 bg-card p-4"
      >
        <div className="h-4 w-1/3 rounded-md bg-secondary animate-ai-pulse" />
        <div className="mt-2 h-3 w-full rounded-md bg-secondary animate-ai-pulse" />
        <div className="mt-1.5 h-3 w-4/5 rounded-md bg-secondary animate-ai-pulse" />
      </li>
    ))}
  </ul>
)

function GitHubSyncControl({
  recordCount,
  onSynced,
}: {
  recordCount: number
  onSynced: () => Promise<void>
}) {
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
    return () => {
      mounted = false
    }
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
    setLoading(true)
    setError('')
    setCopied(false)

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
    if (!token) {
      await handleConnect()
      return
    }

    setLoading(true)
    setError('')
    try {
      await syncWithToken(token)
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError))
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    authAbortRef.current?.abort()
    await disconnectGitHubSync()
    setToken(null)
    setAccount(null)
    setLastSyncAt(null)
    setDeviceFlow(null)
    setError('')
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
      className="liquid-glass-card shrink-0 rounded-2xl px-3 py-2"
      data-testid="vocabify-github-sync"
      aria-label="GitHub vocabulary sync"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.24] text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:border-white/10 dark:bg-white/[0.08]',
            connected && 'text-primary',
          )}
        >
          <Github className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {connected ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : error ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            ) : (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            )}
            <p className="truncate text-[12px] font-semibold leading-4 text-foreground">
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

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={connected ? handleSync : handleConnect}
            disabled={loading}
            className="liquid-glass-button h-7 rounded-lg px-2.5 text-[11px]"
            data-testid="vocabify-github-sync-action"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : connected ? <RefreshCw className="h-3.5 w-3.5" /> : <Github className="h-3.5 w-3.5" />}
            {connected ? 'Sync' : 'Connect'}
          </Button>

          {connected ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDisconnect}
              disabled={loading}
              aria-label="Disconnect GitHub sync"
              title="Disconnect"
              className="liquid-glass-button h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {deviceFlow ? (
        <div
          className="liquid-glass-card mt-2 rounded-xl px-3 py-2 text-[11px] leading-4 text-muted-foreground"
          data-testid="vocabify-github-device-flow"
        >
          <div className="flex items-center justify-between gap-2">
            <span>Enter this code on GitHub</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(deviceFlow.verification_uri, '_blank', 'noopener,noreferrer')}
                className="h-6 px-2 text-[10px]"
              >
                Open
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelDeviceFlow}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
              >
                Cancel
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="liquid-glass-button mt-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 font-mono text-[15px] font-semibold tracking-[0.18em] text-foreground transition-colors"
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
  <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6 py-12">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
      <BookOpen className="h-5 w-5" />
    </div>
    <p className="text-[14px] font-medium text-foreground">
      {hasFilter ? 'No matching words' : 'Your vocabulary is empty'}
    </p>
    <p className="max-w-[260px] text-[13px] text-muted-foreground leading-relaxed">
      {hasFilter
        ? 'Try a different keyword or clear the search.'
        : 'Highlight any word on a page and tap "Vocabify" to save it here.'}
    </p>
  </div>
)

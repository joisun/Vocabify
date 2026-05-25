import React, { useState, useEffect } from 'react'
import { db, type VocabRecord } from '@/lib/vocabifyDb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Search, BookOpen, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VocabList() {
  const [records, setRecords] = useState<VocabRecord[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

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
      await db.records.delete(id)
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
    <div className="flex h-full flex-col gap-3">
      {/* Search */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search vocabulary"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="pl-9 h-9"
          aria-label="Search vocabulary"
        />
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 scrollbar-thin">
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
                    "rounded-xl border border-border/70 bg-card text-card-foreground",
                    "shadow-apple-xs hover:shadow-apple-sm transition-shadow duration-150 ease-spring",
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

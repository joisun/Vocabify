import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import {
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  Github,
  Import,
  LoaderCircle,
  Monitor,
  Moon,
  RotateCcw,
  RefreshCw,
  Save,
  Settings,
  Sun,
  Volume2,
  X,
} from 'lucide-react'
import { AIThinkingBlock, getStreamCharacterState } from '@/components/AIThinkingBlock'
import { MemoryCurvePanel } from '@/components/FamiliarityMeter'
import VocabifySvgIcon from '@/components/custom/VocabifySvgIcon'
import { useTheme } from '@/components/custom/theme-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { RecordEditForm, type EditableFields } from '@/components/RecordEditForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  exportVocabularyPayload,
  getAllRecords,
  getDashboardSnapshot,
  markRecord,
  replaceVocabularyPayload,
  updateRecordFields,
} from '@/lib/vocabApi'
import { FAMILIARITY_LEVELS, getLevel, levelClassSuffix, type FamiliarityLevel, type MarkAction } from '@/lib/familiarity'
import type { DashboardQueueItem, DashboardSnapshot } from '@/lib/dashboard'
import { cn } from '@/lib/utils'
import { useAIStream } from '@/lib/aiStreamClient'
import { speakText } from '@/lib/speech'
import type { VocabResponse } from '@/lib/aiSchema'
import { responseToRecordPatch, type VocabRecord } from '@/lib/vocabTypes'
import {
  githubAccessToken,
} from '@/utils/storage'
import {
  pollGitHubDeviceToken,
  startGitHubDeviceFlow,
  syncVocabularyWithGitHub,
} from '@/lib/githubSync'
import {
  createAnkiCsv,
  createVocabularyCsv,
  createVocabularyExportPayload,
  stringifyVocabularyJson,
  validateVocabularyImportJson,
  type VocabularyImportDryRun,
} from '@/lib/vocabPortability'

type LoadSnapshotOptions = {
  silent?: boolean
}

type ReviewSession = {
  mode: 'review' | 'practice'
  items: DashboardQueueItem[]
}

type DashboardFocusSource = 'due' | 'all' | 'auto'

type DashboardFocus = {
  item: DashboardQueueItem
  source: DashboardFocusSource
  direction: ReviewCardDirection
}

type ReviewCardDirection = -1 | 1
type SpeakHandler = () => void | Promise<void>
type SpeakTextHandler = (text: string) => void | Promise<void>

const reviewCardVariants = {
  enter: (direction: ReviewCardDirection) => ({
    opacity: 0,
    x: direction > 0 ? 72 : -72,
    rotate: direction > 0 ? 0.6 : -0.6,
    scale: 0.985,
  }),
  center: {
    opacity: 1,
    x: 0,
    rotate: 0,
    scale: 1,
  },
  exit: (direction: ReviewCardDirection) => ({
    opacity: 0,
    x: direction > 0 ? -72 : 72,
    rotate: direction > 0 ? -0.6 : 0.6,
    scale: 0.985,
  }),
}

function App() {
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [focusedSelection, setFocusedSelection] = React.useState<DashboardFocus | null>(null)
  const focusedItem = focusedSelection?.item ?? null
  const focusDashboardItem = React.useCallback((
    item: DashboardQueueItem,
    source: 'due' | 'all',
    direction: ReviewCardDirection,
  ) => {
    setFocusedSelection({ item, source, direction })
  }, [])
  const setDashboardFocus = React.useCallback((item: DashboardQueueItem | null, source: DashboardFocusSource = 'auto') => {
    setFocusedSelection(item ? { item, source, direction: 1 } : null)
  }, [])

  const loadSnapshot = React.useCallback(async (options: LoadSnapshotOptions = {}) => {
    if (!options.silent) setLoading(true)
    setError('')
    try {
      const next = await getDashboardSnapshot()
      setSnapshot(next)
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : String(snapshotError))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  React.useEffect(() => {
    const onChanged = (message: unknown) => {
      if ((message as { type?: string })?.type === 'vocabChanged') void loadSnapshot({ silent: true })
    }
    chrome.runtime?.onMessage?.addListener(onChanged)
    return () => chrome.runtime?.onMessage?.removeListener(onChanged)
  }, [loadSnapshot])

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur dark:border-white/[0.04]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          <div className="leading-tight">
            <h1 className="inline-flex items-center font-display text-[14px] font-semibold tracking-tight">
              <VocabifySvgIcon className="text-xl" aria-hidden="true" />
              Vocabify
            </h1>
            <p className="text-[11px] text-muted-foreground">Dashboard</p>
          </div>
          <HeaderStats snapshot={snapshot} loading={loading} />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => void loadSnapshot()} disabled={loading}>
              <RefreshCw className={cn(loading && 'animate-spin')} data-icon="inline-start" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => chrome.runtime.openOptionsPage()}>
              <Settings data-icon="inline-start" />
              Settings
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
        {error ? (
          <Card className="border-destructive/25 bg-destructive/5">
            <CardContent className="p-4 text-[13px] text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[230px_minmax(0,1fr)_310px] lg:overflow-hidden">
          <DashboardWordListPanel
            snapshot={snapshot}
            activeKey={focusedItem ? getDashboardItemKey(focusedItem) : null}
            onFocusItem={focusDashboardItem}
          />
          <ReviewPanel
            snapshot={snapshot}
            loading={loading}
            focusedItem={focusedItem}
            focusedSource={focusedSelection?.source ?? null}
            focusDirection={focusedSelection?.direction ?? null}
            onFocusedItemChange={setDashboardFocus}
            onSnapshotChanged={loadSnapshot}
          />
          <aside className="vocabify-fade-scroll flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            <MemoryCurveCard item={focusedItem} loading={loading} />
            <ImportExportPanel snapshot={snapshot} onImported={() => loadSnapshot()} />
            <SyncPanel snapshot={snapshot} loading={loading} onSynced={() => loadSnapshot({ silent: true })} />
          </aside>
        </div>
      </main>
    </div>
  )
}

function HeaderStats({ snapshot, loading }: { snapshot: DashboardSnapshot | null; loading: boolean }) {
  const stats = [
    { label: 'Total', value: formatNumber(snapshot?.totalWords) },
    { label: 'Due', value: formatNumber(snapshot?.dueCount) },
    { label: 'Today', value: formatNumber(snapshot?.reviewedToday) },
    {
      label: 'Mastered',
      value: formatNumber(snapshot?.levelDistribution.find((item) => item.level === 'MASTERED')?.count),
    },
  ]

  return (
    <div className="ml-4 hidden items-center gap-1.5 md:flex">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-[6px] bg-secondary/55 px-2.5 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          <p className={cn('font-display text-[14px] font-semibold leading-none tracking-tight', loading && 'animate-ai-pulse')}>
            {loading ? '—' : stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const options: Array<{ value: 'light' | 'dark' | 'system'; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]

  return (
    <div className="inline-flex items-center rounded-[6px] border border-border bg-card p-0.5 dark:border-white/[0.04]">
      {options.map((opt) => {
        const Icon = opt.icon
        const isActive = theme === opt.value
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="icon-sm"
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'h-6 w-6 rounded-[4px] text-muted-foreground hover:text-foreground',
              isActive && 'bg-secondary text-foreground',
            )}
          >
            <Icon className="h-3 w-3" />
          </Button>
        )
      })}
    </div>
  )
}

function DashboardWordListPanel({
  snapshot,
  activeKey,
  onFocusItem,
}: {
  snapshot: DashboardSnapshot | null
  activeKey: string | null
  onFocusItem: (item: DashboardQueueItem, source: 'due' | 'all', direction: ReviewCardDirection) => void
}) {
  const [tab, setTab] = React.useState('due')
  const [allWords, setAllWords] = React.useState<DashboardQueueItem[] | null>(null)
  const [loadingAll, setLoadingAll] = React.useState(false)
  const lastFocusRef = React.useRef<{ source: 'due' | 'all'; index: number } | null>(null)
  const dueWords = snapshot?.reviewQueue ?? []

  function focusListItem(item: DashboardQueueItem, source: 'due' | 'all', index: number) {
    const lastFocus = lastFocusRef.current
    const direction: ReviewCardDirection = lastFocus && lastFocus.source === source && index < lastFocus.index ? -1 : 1
    lastFocusRef.current = { source, index }
    onFocusItem(item, source, direction)
  }

  React.useEffect(() => {
    if (tab !== 'all' || allWords) return
    let cancelled = false

    async function loadAllWords() {
      setLoadingAll(true)
      try {
        const records = await getAllRecords()
        if (!cancelled) setAllWords(records.map(recordToDashboardItem))
      } catch (error) {
        console.error('Dashboard all wordlist failed:', error)
        if (!cancelled) setAllWords([])
      } finally {
        if (!cancelled) setLoadingAll(false)
      }
    }

    void loadAllWords()
    return () => {
      cancelled = true
    }
  }, [allWords, tab])

  React.useEffect(() => {
    if (tab === 'all') setAllWords(null)
    // Regenerate lazy all-list after external vocabulary changes.
  }, [snapshot?.generatedAt, tab])

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 p-3 pb-2">
        <CardTitle className="text-[14px]">Wordlist</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-3 pt-0">
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mb-2 h-7 w-full justify-start">
            <TabsTrigger value="due" className="flex-1 px-2 text-[11px]">Due</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 px-2 text-[11px]">All</TabsTrigger>
          </TabsList>
          <TabsContent value="due" className="min-h-0 flex-1 overflow-hidden">
            <DashboardWordListItems
              items={dueWords}
              activeKey={activeKey}
              emptyText="No due words"
              source="due"
              onFocusItem={focusListItem}
            />
          </TabsContent>
          <TabsContent value="all" className="min-h-0 flex-1 overflow-hidden">
            {loadingAll ? (
              <DashboardListSkeleton compact />
            ) : allWords?.length ? (
              <Virtuoso
                data={allWords}
                className="h-full"
                itemContent={(index, item) => (
                  <DashboardWordListItem
                    item={item}
                    active={activeKey === getDashboardItemKey(item)}
                    onFocusItem={() => focusListItem(item, 'all', index)}
                  />
                )}
              />
            ) : (
              <EmptyPanel title={allWords ? 'No words yet' : 'Open All to load'} description="Saved words appear here." />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function DashboardWordListItems({
  items,
  activeKey,
  emptyText,
  source,
  onFocusItem,
}: {
  items: DashboardQueueItem[]
  activeKey: string | null
  emptyText: string
  source: 'due' | 'all'
  onFocusItem: (item: DashboardQueueItem, source: 'due' | 'all', index: number) => void
}) {
  if (items.length === 0) {
    return <EmptyPanel title={emptyText} description="You are clear for now." />
  }

  return (
    <div className="vocabify-fade-scroll flex h-full min-h-0 flex-col gap-1 overflow-y-auto pr-1">
      {items.map((item, index) => (
        <DashboardWordListItem
          key={getDashboardItemKey(item)}
          item={item}
          active={activeKey === getDashboardItemKey(item)}
          onFocusItem={() => onFocusItem(item, source, index)}
        />
      ))}
    </div>
  )
}

function DashboardWordListItem({
  item,
  active,
  onFocusItem,
}: {
  item: DashboardQueueItem
  active: boolean
  onFocusItem: () => void
}) {
  return (
    <button
      type="button"
      onClick={onFocusItem}
      className={cn(
        'w-full rounded-[7px] px-2 py-2 text-left transition-colors',
        active ? 'bg-primary/10 text-foreground ring-1 ring-primary/20' : 'hover:bg-secondary/70',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={`vocabify-level-dot is-${levelClassSuffix(item.level)} shrink-0`} aria-hidden />
        <span className="truncate text-[12px] font-medium">{item.term}</span>
      </div>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{item.definition || item.pos}</p>
    </button>
  )
}

function MemoryCurveCard({ item, loading }: { item: DashboardQueueItem | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-[15px]">Ebbinghaus curve</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {loading ? (
          <DashboardListSkeleton compact />
        ) : item ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={`vocabify-level-dot is-${levelClassSuffix(item.level)} shrink-0`} aria-hidden />
              <p className="truncate text-[13px] font-medium">{item.term}</p>
              <span className="ml-auto tabular text-[12px] text-muted-foreground">{item.score}/100</span>
            </div>
            <MemoryCurvePanel record={item} hideTitle />
          </div>
        ) : (
          <EmptyPanel title="No focus word" description="Select a word to inspect its forgetting curve." />
        )}
      </CardContent>
    </Card>
  )
}

function ReviewPanel({
  snapshot,
  loading,
  focusedItem,
  focusedSource,
  focusDirection,
  onFocusedItemChange,
  onSnapshotChanged,
}: {
  snapshot: DashboardSnapshot | null
  loading: boolean
  focusedItem: DashboardQueueItem | null
  focusedSource: DashboardFocusSource | null
  focusDirection: ReviewCardDirection | null
  onFocusedItemChange: (item: DashboardQueueItem | null, source?: DashboardFocusSource) => void
  onSnapshotChanged: (options?: LoadSnapshotOptions) => Promise<void>
}) {
  const queue = snapshot?.reviewQueue ?? []
  const fallbackWords = snapshot?.recentWords ?? []
  const [revealed, setRevealed] = React.useState(false)
  const [cardStep, setCardStep] = React.useState(0)
  const [settledKeys, setSettledKeys] = React.useState<Set<string>>(() => new Set())
  const [redefiningKey, setRedefiningKey] = React.useState<string | null>(null)
  const [redefiningId, setRedefiningId] = React.useState<number | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [savingEdit, setSavingEdit] = React.useState(false)
  const aiStream = useAIStream()
  const sourceMode = queue.length > 0 ? 'review' : 'practice'
  const sourceItems = sourceMode === 'review' ? queue : fallbackWords
  const [session, setSession] = React.useState<ReviewSession>({
    mode: sourceMode,
    items: [],
  })
  const reviewItems = session.items.length > 0 ? session.items : sourceItems
  const activeReviewItems = reviewItems.filter((item) => !settledKeys.has(getDashboardItemKey(item)))
  const naturalReviewItem = activeReviewItems[0] ?? null
  const focusedKey = focusedItem ? getDashboardItemKey(focusedItem) : null
  const focusedSessionItem = focusedKey
    ? activeReviewItems.find((item) => getDashboardItemKey(item) === focusedKey) ?? focusedItem
    : null
  const reviewItem = focusedSessionItem ?? naturalReviewItem
  const mode = session.items.length > 0 ? session.mode : sourceMode
  const completedCount = Math.max(0, reviewItems.length - activeReviewItems.length)
  const isRedefining = aiStream.status === 'loading' || aiStream.status === 'streaming'
  const reviewItemKey = reviewItem ? getDashboardItemKey(reviewItem) : null
  const isCurrentItemRedefining = !!reviewItemKey && redefiningKey === reviewItemKey
  const displayReviewItem = reviewItem && isCurrentItemRedefining
    ? createReviewDisplayItem(reviewItem, aiStream.partial)
    : reviewItem
  const isAllListPreview = !!focusedItem && focusedSource === 'all'
  const isReviewMode = !!displayReviewItem && mode === 'review' && !isAllListPreview
  const cardDirection = focusDirection ?? 1
  const streamStatusLabel = aiStream.hasReceivedChunk
    ? 'Building'
    : aiStream.hasReceivedReasoning
      ? 'Thinking'
      : 'Loading'

  React.useEffect(() => {
    return () => aiStream.abort()
  }, [aiStream.abort])

  React.useEffect(() => {
    if (!reviewItem) {
      if (focusedItem) onFocusedItemChange(null)
      return
    }
    if (focusedItem && getDashboardItemKey(focusedItem) === getDashboardItemKey(reviewItem)) return
    onFocusedItemChange(reviewItem, 'auto')
  }, [focusedItem, onFocusedItemChange, reviewItem])

  React.useEffect(() => {
    if (loading || !snapshot) return

    setSession((prev) => {
      if (prev.mode !== sourceMode || prev.items.length === 0) {
        return { mode: sourceMode, items: sourceItems }
      }

      const nextByKey = new Map(sourceItems.map((item) => [getDashboardItemKey(item), item]))
      const existingKeys = new Set(prev.items.map(getDashboardItemKey))
      const refreshedItems = prev.items.map((item) => nextByKey.get(getDashboardItemKey(item)) ?? item)
      const appendedItems = sourceItems.filter((item) => !existingKeys.has(getDashboardItemKey(item)))
      return { mode: prev.mode, items: [...refreshedItems, ...appendedItems] }
    })
    // Session order is intentionally stable; snapshot.generatedAt is the refresh boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, snapshot?.generatedAt])

  React.useEffect(() => {
    if (!redefiningId || !redefiningKey || !aiStream.final) return

    let cancelled = false
    const targetKey = redefiningKey
    const finalResponse = aiStream.final

    async function persistRedefinition() {
      await updateRecordFields(redefiningId!, responseToRecordPatch(finalResponse))
      if (cancelled) return
      const updateItem = (item: DashboardQueueItem) => createReviewDisplayItem(item, finalResponse)
      setSession((prev) => updateSessionItem(prev, targetKey, updateItem))
      if (reviewItem && getDashboardItemKey(reviewItem) === targetKey) {
        onFocusedItemChange(updateItem(reviewItem), focusedSource ?? 'auto')
      }
      await onSnapshotChanged({ silent: true })
      if (cancelled) return
      setRedefiningId(null)
      setRedefiningKey(null)
    }

    void persistRedefinition().catch((redefineError) => {
      if (cancelled) return
      console.error('Dashboard redefine failed:', redefineError)
      setRedefiningId(null)
      setRedefiningKey(null)
    })

    return () => {
      cancelled = true
    }
  }, [aiStream.final, focusedSource, onFocusedItemChange, onSnapshotChanged, redefiningId, redefiningKey])

  async function markCurrent(action: MarkAction) {
    if (!reviewItem?.id || isRedefining || !isReviewMode) return
    await markRecord(reviewItem.id, action)
    setSettledKeys((prev) => new Set(prev).add(getDashboardItemKey(reviewItem)))
    onFocusedItemChange(null)
    setRevealed(false)
    setEditing(false)
    setCardStep((step) => step + 1)
    await onSnapshotChanged({ silent: true })
  }

  function redefineCurrent() {
    if (!reviewItem?.id || isRedefining) return
    setRevealed(true)
    setRedefiningId(reviewItem.id)
    setRedefiningKey(getDashboardItemKey(reviewItem))
    aiStream.start(reviewItem.term, reviewItem.sourceContext)
  }

  function resetSession() {
    aiStream.abort()
    setRedefiningId(null)
    setRedefiningKey(null)
    setEditing(false)
    setSettledKeys(new Set())
    setCardStep((step) => step + 1)
    setRevealed(false)
  }

  async function commitEdit(fields: EditableFields) {
    if (!reviewItem?.id || savingEdit) return
    const targetKey = getDashboardItemKey(reviewItem)
    setSavingEdit(true)
    try {
      await updateRecordFields(reviewItem.id, {
        term: fields.term,
        phonetic: fields.phonetic,
        pos: fields.pos,
        senses: fields.senses.map((sense, index) => ({ id: `s${index + 1}`, ...sense })),
        mnemonic: fields.mnemonic,
      })
      const updateItem = (item: DashboardQueueItem) => createReviewItemFromEditableFields(item, fields)
      setSession((prev) => updateSessionItem(prev, targetKey, updateItem))
      onFocusedItemChange(updateItem(reviewItem), focusedSource ?? 'auto')
      setEditing(false)
      await onSnapshotChanged({ silent: true })
    } catch (editError) {
      console.error('Dashboard edit failed:', editError)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-[12px] border border-border bg-secondary/30 p-4 dark:border-white/[0.04]">
      <div className="flex w-full max-w-2xl items-center justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-[16px] font-semibold tracking-tight">
            {isReviewMode ? 'Review session' : 'Word details'}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {isReviewMode
              ? 'Due words are shown one card at a time.'
              : 'Details are shown without changing review state.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-[5px] bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
            {completedCount}/{reviewItems.length}
          </span>
          <span className="rounded-[5px] bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
            {snapshot?.reviewedToday ?? 0} today
          </span>
        </div>
      </div>

      {loading ? (
        <div className="min-h-0 w-full max-w-2xl flex-1">
          <DashboardListSkeleton compact />
        </div>
      ) : displayReviewItem ? (
        <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-3">
          <AnimatePresence mode="wait" custom={cardDirection}>
            <motion.div
              key={`${getDashboardItemKey(displayReviewItem)}-${cardStep}`}
              custom={cardDirection}
              variants={reviewCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="min-h-0 flex-1"
            >
              <ReviewCard
                item={displayReviewItem}
                mode={isReviewMode ? 'review' : 'view'}
                remaining={activeReviewItems.length}
                revealed={isReviewMode ? revealed : true}
                editing={editing}
                savingEdit={savingEdit}
                redefining={isCurrentItemRedefining && isRedefining}
                streamError={isCurrentItemRedefining ? aiStream.error : null}
                streamStatusLabel={streamStatusLabel}
                hasReceivedChunk={aiStream.hasReceivedChunk}
                hasReceivedReasoning={aiStream.hasReceivedReasoning}
                onRedefine={redefineCurrent}
                onSpeak={() => speakText(displayReviewItem.term)}
                onSpeakText={(text) => speakText(text)}
                onEdit={() => {
                  setRevealed(true)
                  setEditing(true)
                }}
                onCancelEdit={() => setEditing(false)}
                onCommitEdit={(fields) => void commitEdit(fields)}
                onReset={resetSession}
              />
            </motion.div>
          </AnimatePresence>
          {isReviewMode ? (
            <ReviewActionBar
              revealed={revealed}
              disabled={isRedefining || editing}
              onReveal={() => setRevealed(true)}
              onMark={(action) => void markCurrent(action)}
            />
          ) : null}
        </div>
      ) : reviewItems.length > 0 ? (
        <Card className="w-full max-w-2xl border-primary/20">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-[17px] font-semibold tracking-tight">Session complete</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">All cards in this session have been reviewed.</p>
            </div>
            <Button
              variant="outline"
              onClick={resetSession}
            >
              <RotateCcw data-icon="inline-start" />
              Restart session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-2xl">
          <CardContent className="p-4">
            <EmptyPanel title="No words yet" description="Save vocabulary while reading to build your review queue." />
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function ReviewCard({
  item,
  mode,
  remaining,
  revealed,
  editing,
  savingEdit,
  redefining,
  streamError,
  streamStatusLabel,
  hasReceivedChunk,
  hasReceivedReasoning,
  onRedefine,
  onSpeak,
  onSpeakText,
  onEdit,
  onCancelEdit,
  onCommitEdit,
  onReset,
}: {
  item: DashboardQueueItem
  mode: 'review' | 'view'
  remaining: number
  revealed: boolean
  editing: boolean
  savingEdit: boolean
  redefining: boolean
  streamError: string | null
  streamStatusLabel: string
  hasReceivedChunk: boolean
  hasReceivedReasoning: boolean
  onRedefine: () => void
  onSpeak: SpeakHandler
  onSpeakText: SpeakTextHandler
  onEdit: () => void
  onCancelEdit: () => void
  onCommitEdit: (fields: EditableFields) => void
  onReset: () => void
}) {
  const editFormId = `vocabify-review-edit-${getDashboardItemKey(item).replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const streamCharacterState = getStreamCharacterState({
    streaming: redefining,
    hasReceivedChunk,
    hasReceivedReasoning,
    hasSenses: false,
  })
  const [speaking, setSpeaking] = React.useState(false)

  async function handleSpeakClick() {
    if (speaking) return
    setSpeaking(true)
    try {
      await onSpeak()
    } finally {
      setSpeaking(false)
    }
  }

  return (
    <Card className="h-full overflow-hidden border-primary/20 bg-card">
      <CardContent className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-5">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`vocabify-level-dot is-${levelClassSuffix(item.level)} shrink-0`} aria-hidden />
            <span className="text-[12px] font-medium text-muted-foreground">{FAMILIARITY_LEVELS[item.level].label}</span>
            {mode === 'review' ? (
              <span className="rounded-[4px] bg-secondary px-1.5 py-[1px] text-[10px] font-medium text-muted-foreground">
                {remaining} remaining
              </span>
            ) : null}
            {mode === 'view' ? (
              <span className="rounded-[4px] bg-secondary px-1.5 py-[1px] text-[10px] font-medium text-muted-foreground">
                View mode
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRedefine}
              disabled={redefining || editing}
              aria-label={`Redefine ${item.term}`}
              title="Redefine"
            >
              <RefreshCw className={cn(redefining && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void handleSpeakClick()}
              disabled={speaking}
              aria-label={`Pronounce ${item.term}`}
              title="Pronounce"
            >
              {speaking ? <LoaderCircle className="animate-spin" /> : <Volume2 />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              disabled={redefining}
              aria-label={`Edit ${item.term}`}
              title="Edit"
            >
              <Edit3 />
            </Button>
            {mode === 'review' ? (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 rounded-[12px] border border-border bg-secondary/30 px-5 py-6 text-center dark:border-white/[0.04]">
          <h3 className="line-clamp-2 break-words font-display text-[clamp(28px,5vw,38px)] font-semibold leading-tight tracking-[-0.04em]">
            {item.term}
          </h3>
          {item.phonetic ? <p className="mt-2 font-mono text-[13px] text-muted-foreground">{item.phonetic}</p> : null}
          {mode === 'review' && !revealed ? (
            <p className="mt-3 text-[12px] text-muted-foreground">Recall the meaning before revealing the card.</p>
          ) : null}
        </div>

        {editing ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <div className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              <RecordEditForm
                key={getDashboardItemKey(item)}
                formId={editFormId}
                initial={item}
                saving={savingEdit}
                hideActions
                onCommit={onCommitEdit}
                onCancel={onCancelEdit}
              />
            </div>
            <div className="shrink-0 border-t border-border/70 bg-card pt-3 dark:border-white/[0.04]">
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} disabled={savingEdit}>
                  <X data-icon="inline-start" />
                  Cancel
                </Button>
                <Button type="submit" form={editFormId} size="sm" disabled={savingEdit}>
                  {savingEdit ? (
                    'Saving...'
                  ) : (
                    <>
                      <Save data-icon="inline-start" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : revealed ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            {streamError ? (
              <div className="shrink-0 rounded-[7px] bg-destructive/10 px-3 py-2 text-[12px] leading-relaxed text-destructive">
                {streamError}
              </div>
            ) : redefining ? (
              <AIThinkingBlock
                label={streamStatusLabel}
                state={streamCharacterState}
                compact
                className="shrink-0 self-start"
              />
            ) : null}
            <div className="vocabify-fade-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              <VocabDefinition item={item} onSpeakText={onSpeakText} />
            </div>
          </motion.div>
        ) : (
          <div className="mt-auto shrink-0 rounded-[8px] border border-dashed border-border bg-secondary/20 px-3 py-4 text-center text-[12px] text-muted-foreground dark:border-white/[0.04]">
            Use the action bar below when you are ready.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReviewActionBar({
  revealed,
  disabled,
  onReveal,
  onMark,
}: {
  revealed: boolean
  disabled: boolean
  onReveal: () => void
  onMark: (action: MarkAction) => void
}) {
  if (!revealed) {
    return (
      <div className="shrink-0 rounded-[10px] border border-border bg-card p-2 dark:border-white/[0.04]">
        <Button size="lg" onClick={onReveal} disabled={disabled} className="w-full">
          Reveal definition
        </Button>
      </div>
    )
  }

  return (
    <div className="grid shrink-0 grid-cols-3 gap-2 rounded-[10px] border border-border bg-card p-2 dark:border-white/[0.04]">
      <Button variant="outline" onClick={() => onMark('FORGET')} disabled={disabled}>Forget</Button>
      <Button variant="outline" onClick={() => onMark('FUZZY')} disabled={disabled}>Fuzzy</Button>
      <Button onClick={() => onMark('KNOW')} disabled={disabled}>Know</Button>
    </div>
  )
}

function VocabDefinition({ item, onSpeakText }: { item: DashboardQueueItem; onSpeakText: SpeakTextHandler }) {
  const isPhrase = item.pos === 'phrase'
  const [speakingExampleKey, setSpeakingExampleKey] = React.useState<string | null>(null)

  async function handleExampleSpeak(text: string, key: string) {
    if (speakingExampleKey) return
    setSpeakingExampleKey(key)
    try {
      await onSpeakText(text)
    } finally {
      setSpeakingExampleKey(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`vocabify-level-dot is-${levelClassSuffix(item.level)} shrink-0`} aria-hidden />
        <span className="rounded-[3px] bg-secondary px-1.5 py-[1px] text-[10px] font-medium text-muted-foreground">
          {FAMILIARITY_LEVELS[item.level].label}
        </span>
        {!isPhrase ? (
          <span className="rounded-[3px] bg-secondary px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.pos}
          </span>
        ) : null}
        <span className="ml-auto tabular text-[12px] text-muted-foreground">{item.score}/100</span>
      </div>
      {item.senses.map((sense, index) => (
        <div key={sense.id || index} className="rounded-[7px] bg-secondary/45 px-3 py-2">
          <p className="text-[13px] leading-relaxed text-foreground">
            {!isPhrase ? <span className="mr-1 text-primary">{index + 1}.</span> : null}
            {sense.definition}
          </p>
          {sense.example ? (
            <div className="mt-1 flex items-start gap-1.5">
              <p className="min-w-0 flex-1 text-[12px] italic leading-relaxed text-muted-foreground">"{sense.example}"</p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void handleExampleSpeak(sense.example || '', `${sense.id || index}`)}
                disabled={!!speakingExampleKey}
                aria-label="Pronounce example"
                title="Pronounce example"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                {speakingExampleKey === `${sense.id || index}` ? (
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : null}
          {sense.exampleTranslation ? (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/85">{sense.exampleTranslation}</p>
          ) : null}
        </div>
      ))}
      {item.mnemonic && !isPhrase ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Mnemonic: </span>{item.mnemonic}
        </p>
      ) : null}
      {item.sourceUrl ? (
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-[11px] text-primary hover:underline">
          {safeHostname(item.sourceUrl)}
        </a>
      ) : null}
    </div>
  )
}

function SyncPanel({
  snapshot,
  loading,
  onSynced,
}: {
  snapshot: DashboardSnapshot | null
  loading: boolean
  onSynced: () => Promise<void>
}) {
  const sync = snapshot?.sync
  const [token, setToken] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState(false)
  const [syncStatus, setSyncStatus] = React.useState('')
  const [syncError, setSyncError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    githubAccessToken.getValue().then((nextToken) => {
      if (!cancelled) setToken(nextToken)
    })
    return () => {
      cancelled = true
    }
  }, [sync?.connected])

  async function syncWithToken(nextToken: string) {
    const result = await syncVocabularyWithGitHub(nextToken)
    setToken(nextToken)
    setSyncStatus(`Synced ${result.recordCount} words.`)
    await onSynced()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncError('')
    setSyncStatus('')
    try {
      if (token) {
        await syncWithToken(token)
        return
      }

      const flow = await startGitHubDeviceFlow()
      setSyncStatus(`Enter code ${flow.user_code} in GitHub.`)
      window.open(flow.verification_uri, '_blank', 'noopener,noreferrer')
      const nextToken = await pollGitHubDeviceToken(flow)
      await syncWithToken(nextToken)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 p-4">
        <div>
          <CardTitle className="text-[15px]">Sync status</CardTitle>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Sync your private GitHub data center.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          <Github data-icon="inline-start" />
          {syncing ? 'Syncing…' : token || sync?.connected ? 'Sync now' : 'Connect'}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 pt-0">
        <StatusTile label="Connection" value={loading ? '—' : sync?.connected ? 'Connected' : 'Not connected'} active={!!sync?.connected} />
        <StatusTile label="Account" value={sync?.account ?? '—'} />
        <StatusTile label="Last sync" value={sync?.lastSyncAt ? formatRelativeTime(sync.lastSyncAt) : '—'} />
        {syncStatus ? <p className="text-[11px] leading-relaxed text-muted-foreground">{syncStatus}</p> : null}
        {syncError ? <p className="text-[11px] leading-relaxed text-destructive">{syncError}</p> : null}
      </CardContent>
    </Card>
  )
}

function ImportExportPanel({
  snapshot,
  onImported,
}: {
  snapshot: DashboardSnapshot | null
  onImported: () => Promise<void>
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [dryRun, setDryRun] = React.useState<VocabularyImportDryRun | null>(null)
  const [importText, setImportText] = React.useState('')
  const [importing, setImporting] = React.useState(false)
  const [status, setStatus] = React.useState('')

  async function readExportPayload() {
    const raw = await exportVocabularyPayload()
    return createVocabularyExportPayload(raw)
  }

  async function handleExportJson() {
    const payload = await readExportPayload()
    downloadTextFile(
      `vocabify-export-${toFileStamp(payload.updatedAt)}.json`,
      stringifyVocabularyJson(payload),
      'application/json',
    )
  }

  async function handleExportCsv() {
    const payload = await readExportPayload()
    downloadTextFile(
      `vocabify-words-${toFileStamp(payload.updatedAt)}.csv`,
      createVocabularyCsv(payload.records),
      'text/csv;charset=utf-8',
    )
  }

  async function handleExportAnkiCsv() {
    const payload = await readExportPayload()
    downloadTextFile(
      `vocabify-anki-${toFileStamp(payload.updatedAt)}.csv`,
      createAnkiCsv(payload.records),
      'text/csv;charset=utf-8',
    )
  }

  async function handleSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const nextDryRun = validateVocabularyImportJson(text)
    setImportText(text)
    setDryRun(nextDryRun)
    setStatus(nextDryRun.valid ? 'Ready to import.' : 'Import file is invalid.')
  }

  function handlePasteImportText(value: string) {
    setImportText(value)
    if (!value.trim()) {
      setDryRun(null)
      setStatus('')
      return
    }
    const nextDryRun = validateVocabularyImportJson(value)
    setDryRun(nextDryRun)
    setStatus(nextDryRun.valid ? 'Ready to import.' : 'Import JSON is invalid.')
  }

  async function handleConfirmImport() {
    if (!dryRun?.payload) return
    setImporting(true)
    setStatus('')
    try {
      const backup = await readExportPayload()
      downloadTextFile(
        `vocabify-backup-before-import-${toFileStamp(new Date().toISOString())}.json`,
        stringifyVocabularyJson(backup),
        'application/json',
      )
      await replaceVocabularyPayload({
        records: dryRun.payload.records,
        tombstones: dryRun.payload.tombstones,
      })
      setImportText('')
      setDryRun(null)
      setStatus(`Imported ${dryRun.recordCount} records and ${dryRun.tombstoneCount} tombstones.`)
      await onImported()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-[15px]">Import / Export</CardTitle>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{snapshot?.totalWords ?? 0} local words available.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-2">
          <Button variant="default" className="justify-start" onClick={handleExportJson}>
            <Download data-icon="inline-start" />
            Export JSON backup
          </Button>
          <Button variant="outline" className="justify-start" onClick={handleExportCsv}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
          <Button variant="outline" className="justify-start" onClick={handleExportAnkiCsv}>
            <Download data-icon="inline-start" />
            Export Anki CSV
          </Button>
          <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
            JSON uses the full Vocabify sync payload shape. CSV exports are one-way portable files.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 dark:border-white/[0.04]">
          <p className="text-[12px] font-medium">Overwrite import</p>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Import data-icon="inline-start" />
            Choose
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleSelectFile}
          />
          <Textarea
            value={importText}
            onChange={(event) => handlePasteImportText(event.target.value)}
            placeholder="Paste Vocabify JSON here for dry-run validation."
            className="min-h-[96px] font-mono text-[12px]"
          />
          {dryRun ? <ImportDryRunPanel dryRun={dryRun} /> : null}
          {status ? <p className="text-[12px] text-muted-foreground">{status}</p> : null}
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!dryRun?.valid || importing}>
                  {importing ? 'Importing…' : 'Overwrite local data'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Overwrite local vocabulary?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will replace local records with the validated import payload. A JSON backup of current local data will download before the overwrite starts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmImport} disabled={importing}>
                    Overwrite
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ImportDryRunPanel({ dryRun }: { dryRun: VocabularyImportDryRun }) {
  return (
    <div className={cn(
      'rounded-[7px] border px-3 py-2 text-[12px] leading-relaxed',
      dryRun.valid
        ? 'border-primary/20 bg-primary/5 text-foreground'
        : 'border-destructive/25 bg-destructive/5 text-destructive',
    )}>
      <div className="grid grid-cols-2 gap-2">
        <MetricRow label="Schema" value={dryRun.schemaVersion ?? 0} />
        <MetricRow label="Records" value={dryRun.recordCount} />
        <MetricRow label="Tombstones" value={dryRun.tombstoneCount} />
        <MetricRow label="Invalid" value={dryRun.invalidEntryCount} />
      </div>
      {dryRun.errors.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {dryRun.errors.map((error) => (
            <p key={error} className="text-[11px]">{error}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StatusTile({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="rounded-[7px] border border-border bg-secondary/35 px-3 py-2 dark:border-white/[0.04]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] font-medium">
        {active ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
        {value}
      </p>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="tabular text-[13px] font-medium">{value}</span>
    </div>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-start gap-1 px-4 py-10">
      <BarChart3 className="h-4 w-4 text-muted-foreground" />
      <p className="text-[13px] font-medium">{title}</p>
      <p className="max-w-md text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function DashboardListSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
        <div key={index} className="rounded-[7px] border border-border bg-secondary/40 px-3 py-3 dark:border-white/[0.04]">
          <div className="vocabify-skeleton-breathe h-3 w-1/3 rounded" />
          <div className="vocabify-skeleton-breathe mt-2 h-2.5 w-5/6 rounded" />
        </div>
      ))}
    </div>
  )
}

function formatNumber(value?: number) {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat().format(value)
}

function createReviewDisplayItem(item: DashboardQueueItem, partial: Partial<VocabResponse>): DashboardQueueItem {
  const senses = partial.senses?.length
    ? partial.senses.map((sense, index) => ({
        id: `s${index + 1}`,
        definition: sense.definition,
        example: sense.example,
        exampleTranslation: sense.exampleTranslation,
      }))
    : item.senses

  return {
    ...item,
    term: partial.term ?? item.term,
    phonetic: 'phonetic' in partial ? partial.phonetic ?? '' : item.phonetic,
    pos: partial.pos ?? item.pos,
    senses,
    definition: senses[0]?.definition || item.definition,
    mnemonic: 'mnemonic' in partial ? partial.mnemonic ?? '' : item.mnemonic,
  }
}

function createReviewItemFromEditableFields(item: DashboardQueueItem, fields: EditableFields): DashboardQueueItem {
  const senses = fields.senses.map((sense, index) => ({
    id: `s${index + 1}`,
    definition: sense.definition,
    example: sense.example,
    exampleTranslation: sense.exampleTranslation,
  }))

  return {
    ...item,
    term: fields.term,
    phonetic: fields.phonetic,
    pos: fields.pos,
    senses,
    definition: senses[0]?.definition || '',
    mnemonic: fields.mnemonic,
  }
}

function recordToDashboardItem(record: VocabRecord): DashboardQueueItem {
  return {
    id: record.id,
    term: record.term,
    phonetic: record.phonetic,
    pos: record.pos,
    senses: record.senses,
    definition: record.senses[0]?.definition || '',
    mnemonic: record.mnemonic,
    sourceUrl: record.sourceUrl,
    sourceContext: record.sourceContext,
    score: record.score,
    firstMarkedAt: record.firstMarkedAt,
    lastMarkedAt: record.lastMarkedAt,
    lastDecayAt: record.lastDecayAt,
    memoryAnchorScore: record.memoryAnchorScore,
    memoryAnchorAt: record.memoryAnchorAt,
    memoryHorizonDays: record.memoryHorizonDays,
    memoryCurve: record.memoryCurve,
    lastReviewDate: record.lastReviewDate ?? null,
    lastReviewAction: record.lastReviewAction,
    dailyReviewBaseScore: record.dailyReviewBaseScore,
    level: getLevel(record.score),
    updatedAt: record.updatedAt,
  }
}

function updateSessionItem(
  session: ReviewSession,
  key: string,
  update: (item: DashboardQueueItem) => DashboardQueueItem,
): ReviewSession {
  return {
    ...session,
    items: session.items.map((item) => (getDashboardItemKey(item) === key ? update(item) : item)),
  }
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

function downloadTextFile(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toFileStamp(value: string) {
  const date = new Date(value)
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  return safe.toISOString().replace(/[:.]/g, '-')
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

function getDashboardItemKey(item: DashboardQueueItem) {
  return item.id != null ? `id:${item.id}` : `term:${item.term}`
}

export default App

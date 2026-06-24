import { FAMILIARITY_LEVELS, getLevel, getLocalReviewDate, type FamiliarityFields, type FamiliarityLevel } from '@/lib/familiarity'
import type { PosType, VocabRecord, VocabSense } from '@/lib/vocabTypes'
import {
  HIGHLIGHT_LEVELS,
  normalizeHighlightStyleSettings,
  type GithubSyncAccount,
  type highlightStyleSettingsType,
} from '@/utils/storage'

export type DashboardLevelSummary = {
  level: FamiliarityLevel
  label: string
  count: number
  percentage: number
  visible: boolean
}

export type DashboardQueueItem = FamiliarityFields & {
  id?: number
  term: string
  phonetic: string
  pos: PosType
  senses: VocabSense[]
  definition: string
  mnemonic: string
  sourceUrl: string
  sourceContext: string
  level: FamiliarityLevel
  updatedAt: string
}

export type DashboardSnapshot = {
  generatedAt: string
  totalWords: number
  newToday: number
  dueCount: number
  reviewedToday: number
  levelDistribution: DashboardLevelSummary[]
  reviewQueue: DashboardQueueItem[]
  recentWords: DashboardQueueItem[]
  sync: {
    connected: boolean
    account: string | null
    repoName: string | null
    lastSyncAt: string | null
  }
  highlightVisibility: {
    visibleLevels: FamiliarityLevel[]
    hiddenLevels: FamiliarityLevel[]
    levels: Record<FamiliarityLevel, boolean>
  }
}

export function buildDashboardSnapshot({
  records,
  highlightSettings,
  githubToken,
  githubAccount,
  githubLastSyncAt,
  now = Date.now(),
}: {
  records: VocabRecord[]
  highlightSettings: highlightStyleSettingsType | null
  githubToken: string | null
  githubAccount: GithubSyncAccount | null
  githubLastSyncAt: string | null
  now?: number
}): DashboardSnapshot {
  const today = getLocalReviewDate(now)
  const normalizedHighlight = normalizeHighlightStyleSettings(highlightSettings)
  const visibility = HIGHLIGHT_LEVELS.reduce((acc, level) => {
    acc[level] = !!normalizedHighlight.levelStyles[level]?.enabled
    return acc
  }, {} as Record<FamiliarityLevel, boolean>)
  const counts = HIGHLIGHT_LEVELS.reduce((acc, level) => {
    acc[level] = 0
    return acc
  }, {} as Record<FamiliarityLevel, number>)

  for (const record of records) {
    counts[getLevel(record.score)] += 1
  }

  const totalWords = records.length
  const newToday = records.filter((record) => getRecordLocalDate(record.createdAt) === today).length
  const reviewedToday = records.filter((record) => record.lastReviewDate === today).length
  const dueRecords = records.filter((record) => {
    const createdDate = getRecordLocalDate(record.createdAt)
    return createdDate !== today
      && record.lastReviewDate !== today
      && record.score < FAMILIARITY_LEVELS.MASTERED.min
  })
  const toQueueItem = (record: VocabRecord): DashboardQueueItem => ({
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
    lastReviewAction: record.lastReviewAction,
    dailyReviewBaseScore: record.dailyReviewBaseScore,
    level: getLevel(record.score),
    updatedAt: record.updatedAt,
    lastReviewDate: record.lastReviewDate ?? null,
  })

  return {
    generatedAt: new Date(now).toISOString(),
    totalWords,
    newToday,
    dueCount: dueRecords.length,
    reviewedToday,
    levelDistribution: HIGHLIGHT_LEVELS.map((level) => ({
      level,
      label: FAMILIARITY_LEVELS[level].label,
      count: counts[level],
      percentage: totalWords > 0 ? Math.round((counts[level] / totalWords) * 100) : 0,
      visible: visibility[level],
    })),
    reviewQueue: dueRecords
      .slice()
      .sort((first, second) => {
        if (first.score !== second.score) return first.score - second.score
        return new Date(first.updatedAt).getTime() - new Date(second.updatedAt).getTime()
      })
      .map(toQueueItem),
    recentWords: records
      .slice()
      .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
      .slice(0, 24)
      .map(toQueueItem),
    sync: {
      connected: !!githubToken && !!githubAccount,
      account: githubAccount?.login ?? null,
      repoName: githubAccount?.repoName ?? null,
      lastSyncAt: githubLastSyncAt,
    },
    highlightVisibility: {
      visibleLevels: HIGHLIGHT_LEVELS.filter((level) => visibility[level]),
      hiddenLevels: HIGHLIGHT_LEVELS.filter((level) => !visibility[level]),
      levels: visibility,
    },
  }
}

function getRecordLocalDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : getLocalReviewDate(date)
}

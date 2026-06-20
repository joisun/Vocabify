/**
 * Anchor-based memory engine.
 *
 * User marks create a new memory anchor. Reads materialize the current score
 * from that anchor through a bounded cubic-bezier forgetting curve.
 */

export type FamiliarityLevel = 'NEW' | 'LEARNING' | 'FAMILIAR' | 'MASTERED'

export const FAMILIARITY_LEVELS: Record<FamiliarityLevel, { min: number; max: number; label: string }> = {
  NEW: { min: 0, max: 0, label: 'New' },
  LEARNING: { min: 1, max: 40, label: 'Learning' },
  FAMILIAR: { min: 41, max: 70, label: 'Familiar' },
  MASTERED: { min: 71, max: 100, label: 'Mastered' },
}

export const SCORE_MIN = 0
export const SCORE_MAX = 100

export type MarkAction = 'KNOW' | 'FUZZY' | 'FORGET'

export type MemoryCurve = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface FamiliarityFields {
  score: number
  firstMarkedAt: string | null
  lastMarkedAt: string | null
  lastDecayAt: string | null
  memoryAnchorScore?: number
  memoryAnchorAt?: string | null
  memoryHorizonDays?: number
  memoryCurve?: MemoryCurve
  lastReviewDate?: string | null
  lastReviewAction?: MarkAction | null
  dailyReviewBaseScore?: number | null
}

export interface SettleResult<T extends FamiliarityFields> {
  next: T
  changed: boolean
}

export type MemoryCurvePoint = {
  elapsedRatio: number
  day: number
  score: number
  x: number
  y: number
}

export type MaterializedMemory<T extends FamiliarityFields> = {
  record: T
  changed: boolean
  level: FamiliarityLevel
  anchorScore: number
  currentScore: number
  projectedEndScore: number
  elapsedRatio: number
  elapsedDays: number
  horizonDays: number
  curve: MemoryCurve
  anchorAt: string | null
}

const DAY_MS = 86_400_000
const DEFAULT_CURVE: MemoryCurve = { x1: 0.18, y1: 0.04, x2: 0.82, y2: 1 }
const NEW_HORIZON_DAYS = 0
const HORIZON_DAYS_BY_LEVEL: Record<FamiliarityLevel, number> = {
  NEW: NEW_HORIZON_DAYS,
  LEARNING: 9,
  FAMILIAR: 42,
  MASTERED: 180,
}
const MAX_DECAY_BY_LEVEL: Record<FamiliarityLevel, number> = {
  NEW: 0,
  LEARNING: 28,
  FAMILIAR: 24,
  MASTERED: 18,
}
const FUZZY_LOW_TARGET = 60
const FUZZY_HIGH_TARGET = 70

/** Map a numeric score to its 4-tier level. */
export function getLevel(score: number): FamiliarityLevel {
  if (score <= 0) return 'NEW'
  if (score <= 40) return 'LEARNING'
  if (score <= 70) return 'FAMILIAR'
  return 'MASTERED'
}

export function clampScore(score: number) {
  if (!Number.isFinite(score) || Number.isNaN(score)) return SCORE_MIN
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(score)))
}

export function getMemoryHorizonDays(scoreOrLevel: number | FamiliarityLevel) {
  const level = typeof scoreOrLevel === 'number' ? getLevel(scoreOrLevel) : scoreOrLevel
  return HORIZON_DAYS_BY_LEVEL[level]
}

export function normalizeMemoryCurve(curve?: Partial<MemoryCurve> | null): MemoryCurve {
  const x1 = clampUnit(typeof curve?.x1 === 'number' ? curve.x1 : DEFAULT_CURVE.x1)
  const x2 = clampUnit(typeof curve?.x2 === 'number' ? curve.x2 : DEFAULT_CURVE.x2)
  return {
    x1: Math.min(x1, x2),
    y1: clampUnit(typeof curve?.y1 === 'number' ? curve.y1 : DEFAULT_CURVE.y1),
    x2: Math.max(x1, x2),
    y2: clampUnit(typeof curve?.y2 === 'number' ? curve.y2 : DEFAULT_CURVE.y2),
  }
}

export function materializeMemory<T extends FamiliarityFields>(
  record: T,
  now: number = Date.now(),
): MaterializedMemory<T> {
  const fallbackAnchorAt = record.lastMarkedAt || record.lastDecayAt || null
  const anchorAt = normalizeOptionalDate(record.memoryAnchorAt) || normalizeOptionalDate(fallbackAnchorAt)
  const anchorScore = clampScore(
    typeof record.memoryAnchorScore === 'number' ? record.memoryAnchorScore : record.score,
  )
  const anchorLevel = getLevel(anchorScore)
  const curve = normalizeMemoryCurve(record.memoryCurve)
  const horizonDays = normalizeHorizonDays(record.memoryHorizonDays, anchorLevel)
  const anchorTime = anchorAt ? new Date(anchorAt).getTime() : NaN
  const elapsedMs = Number.isFinite(anchorTime) ? Math.max(0, now - anchorTime) : 0
  const elapsedDays = elapsedMs / DAY_MS
  const elapsedRatio = horizonDays > 0 ? clampUnit(elapsedMs / (horizonDays * DAY_MS)) : 0
  const forgetRatio = cubicBezierYForX(curve, elapsedRatio)
  const maxDecay = Math.min(anchorScore, MAX_DECAY_BY_LEVEL[anchorLevel])
  const currentScore = clampScore(anchorScore - maxDecay * forgetRatio)
  const projectedEndScore = clampScore(anchorScore - maxDecay)
  const normalizedAnchorAt = anchorAt
  const normalizedHorizonDays = horizonDays
  const changed =
    currentScore !== record.score ||
    record.memoryAnchorScore !== anchorScore ||
    record.memoryAnchorAt !== normalizedAnchorAt ||
    record.memoryHorizonDays !== normalizedHorizonDays ||
    !sameCurve(record.memoryCurve, curve)

  return {
    record: {
      ...record,
      score: currentScore,
      memoryAnchorScore: anchorScore,
      memoryAnchorAt: normalizedAnchorAt,
      memoryHorizonDays: normalizedHorizonDays,
      memoryCurve: curve,
      lastDecayAt: record.lastDecayAt ?? normalizedAnchorAt,
    },
    changed,
    level: getLevel(currentScore),
    anchorScore,
    currentScore,
    projectedEndScore,
    elapsedRatio,
    elapsedDays,
    horizonDays,
    curve,
    anchorAt: normalizedAnchorAt,
  }
}

export function settleDecay<T extends FamiliarityFields>(
  record: T,
  now: number = Date.now(),
): SettleResult<T> {
  const materialized = materializeMemory(record, now)
  return {
    next: materialized.record,
    changed: materialized.changed,
  }
}

export function applyMark<T extends FamiliarityFields>(
  record: T,
  action: MarkAction,
  now: number = Date.now(),
): T {
  const settled = materializeMemory(record, now).record
  const nowIso = new Date(now).toISOString()
  const reviewDate = getLocalReviewDate(now)
  const reviewedToday = record.lastReviewDate === reviewDate
  const baseScore = reviewedToday && typeof record.dailyReviewBaseScore === 'number'
    ? clampScore(record.dailyReviewBaseScore)
    : settled.score
  const newScore = clampScore(baseScore + getMarkDelta(baseScore, action))
  const horizonDays = getMemoryHorizonDays(newScore)
  const anchorAt = reviewedToday
    ? normalizeOptionalDate(record.memoryAnchorAt) || normalizeOptionalDate(record.lastMarkedAt) || nowIso
    : nowIso

  return {
    ...settled,
    score: newScore,
    firstMarkedAt: settled.firstMarkedAt ?? nowIso,
    lastMarkedAt: nowIso,
    lastDecayAt: anchorAt,
    memoryAnchorScore: newScore,
    memoryAnchorAt: anchorAt,
    memoryHorizonDays: horizonDays,
    memoryCurve: normalizeMemoryCurve(settled.memoryCurve),
    lastReviewDate: reviewDate,
    lastReviewAction: action,
    dailyReviewBaseScore: baseScore,
  }
}

export function getMarkDelta(score: number, action: MarkAction) {
  const clamped = clampScore(score)
  if (action === 'KNOW') {
    if (clamped <= 40) return 18
    if (clamped <= 70) return 12
    return 6
  }
  if (action === 'FUZZY') {
    if (clamped < FUZZY_LOW_TARGET) return Math.min(6, FUZZY_LOW_TARGET - clamped)
    if (clamped <= FUZZY_HIGH_TARGET) return 0
    return Math.max(-4, FUZZY_HIGH_TARGET - clamped)
  }
  if (clamped <= 40) return -12
  if (clamped <= 70) return -20
  return -30
}

export function createInitialFamiliarity(): FamiliarityFields {
  return {
    score: SCORE_MIN,
    firstMarkedAt: null,
    lastMarkedAt: null,
    lastDecayAt: null,
    memoryAnchorScore: SCORE_MIN,
    memoryAnchorAt: null,
    memoryHorizonDays: NEW_HORIZON_DAYS,
    memoryCurve: DEFAULT_CURVE,
    lastReviewDate: null,
    lastReviewAction: null,
    dailyReviewBaseScore: null,
  }
}

export function getLocalReviewDate(now: number | Date = Date.now()) {
  const date = typeof now === 'number' ? new Date(now) : now
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMemoryCurvePoints(
  record: FamiliarityFields,
  now: number = Date.now(),
  samples: number = 32,
): MemoryCurvePoint[] {
  const materialized = materializeMemory(record, now)
  const count = Math.max(2, Math.min(96, Math.round(samples)))
  const maxDecay = Math.max(0, materialized.anchorScore - materialized.projectedEndScore)

  return Array.from({ length: count }).map((_, index) => {
    const elapsedRatio = index / (count - 1)
    const forgetRatio = cubicBezierYForX(materialized.curve, elapsedRatio)
    const score = clampScore(materialized.anchorScore - maxDecay * forgetRatio)
    return {
      elapsedRatio,
      day: elapsedRatio * materialized.horizonDays,
      score,
      x: elapsedRatio,
      y: score / SCORE_MAX,
    }
  })
}

export function getMemorySnapshot(record: FamiliarityFields, now: number = Date.now()) {
  const materialized = materializeMemory(record, now)
  return {
    ...materialized,
    points: getMemoryCurvePoints(materialized.record, now),
  }
}

/** CSS class suffix for a given level (used by the highlight stylesheet). */
export function levelClassSuffix(level: FamiliarityLevel): string {
  return level.toLowerCase()
}

function normalizeHorizonDays(value: unknown, level: FamiliarityLevel) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  return getMemoryHorizonDays(level)
}

function cubicBezierYForX(curve: MemoryCurve, x: number) {
  const targetX = clampUnit(x)
  if (targetX <= 0) return 0
  if (targetX >= 1) return 1

  let lower = 0
  let upper = 1
  let t = targetX

  for (let i = 0; i < 24; i += 1) {
    t = (lower + upper) / 2
    const currentX = cubicBezier(t, 0, curve.x1, curve.x2, 1)
    if (Math.abs(currentX - targetX) < 0.00001) break
    if (currentX < targetX) lower = t
    else upper = t
  }

  return clampUnit(cubicBezier(t, 0, curve.y1, curve.y2, 1))
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const inv = 1 - t
  return inv * inv * inv * p0
    + 3 * inv * inv * t * p1
    + 3 * inv * t * t * p2
    + t * t * t * p3
}

function clampUnit(value: number) {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function sameCurve(first: MemoryCurve | undefined, second: MemoryCurve) {
  if (!first) return false
  return first.x1 === second.x1
    && first.y1 === second.y1
    && first.x2 === second.x2
    && first.y2 === second.y2
}

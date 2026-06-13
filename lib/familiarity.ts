/**
 * Familiarity scoring engine.
 *
 * Each vocab record carries a score in [0, 100]. The score:
 *   - increases on user-driven marks (Know +15, Fuzzy +5, Forget -10)
 *   - decays passively over time, with the rate determined by current level
 *   - is clamped to [0, 100] and used to derive a 4-tier level + highlight color
 *
 * Decay is settled lazily (right before highlighting / marking), so we never need
 * background timers — every read of a record may settle accumulated decay first
 * and write the new score back.
 */

export type FamiliarityLevel = 'NEW' | 'LEARNING' | 'FAMILIAR' | 'MASTERED'

export const FAMILIARITY_LEVELS: Record<FamiliarityLevel, { min: number; max: number; label: string }> = {
  NEW:      { min: 0,  max: 0,   label: 'New' },
  LEARNING: { min: 1,  max: 40,  label: 'Learning' },
  FAMILIAR: { min: 41, max: 70,  label: 'Familiar' },
  MASTERED: { min: 71, max: 100, label: 'Mastered' },
}

export const MARK_DELTA = {
  KNOW: 15,
  FUZZY: 5,
  FORGET: -10,
} as const

export type MarkAction = keyof typeof MARK_DELTA

/**
 * Decay rules: at the given level, deduct `amount` points every `intervalDays`.
 * `null` means the level never decays (NEW words sit at 0 until first mark).
 */
export const DECAY_RULES: Record<FamiliarityLevel, { intervalDays: number; amount: number } | null> = {
  NEW: null,
  LEARNING: { intervalDays: 3, amount: 10 },
  FAMILIAR: { intervalDays: 14, amount: 10 },
  MASTERED: { intervalDays: 60, amount: 5 },
}

export const SCORE_MIN = 0
export const SCORE_MAX = 100

const DAY_MS = 86_400_000

/** Map a numeric score to its 4-tier level. */
export function getLevel(score: number): FamiliarityLevel {
  if (score <= 0) return 'NEW'
  if (score <= 40) return 'LEARNING'
  if (score <= 70) return 'FAMILIAR'
  return 'MASTERED'
}

export function clampScore(score: number) {
  if (Number.isNaN(score)) return SCORE_MIN
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(score)))
}

export interface FamiliarityFields {
  score: number
  firstMarkedAt: string | null
  lastMarkedAt: string | null
  lastDecayAt: string | null
}

export interface SettleResult<T extends FamiliarityFields> {
  next: T
  changed: boolean
}

/**
 * Compute how much decay should apply between `lastDecayAt` and `now`,
 * deduct it from the score, and advance `lastDecayAt` by the consumed
 * whole intervals (the leftover sub-interval rolls over to next time).
 *
 * Step-wise decay: we use the CURRENT level's rule for the whole gap.
 * If the score crosses into a slower tier mid-gap, the over-deduction
 * is bounded by the SCORE_MIN clamp; if it crosses into a faster tier,
 * we under-deduct slightly — which is acceptable for the simplicity gain.
 *
 * Records that have never been marked (firstMarkedAt == null) never decay.
 */
export function settleDecay<T extends FamiliarityFields>(
  record: T,
  now: number = Date.now(),
): SettleResult<T> {
  if (!record.firstMarkedAt || !record.lastDecayAt) {
    return { next: record, changed: false }
  }

  const level = getLevel(record.score)
  const rule = DECAY_RULES[level]
  if (!rule) return { next: record, changed: false }

  const lastDecay = new Date(record.lastDecayAt).getTime()
  if (Number.isNaN(lastDecay)) return { next: record, changed: false }

  const intervalMs = rule.intervalDays * DAY_MS
  const elapsedMs = now - lastDecay
  if (elapsedMs < intervalMs) return { next: record, changed: false }

  const ticks = Math.floor(elapsedMs / intervalMs)
  const consumedMs = ticks * intervalMs
  const newScore = clampScore(record.score - ticks * rule.amount)
  const newLastDecayAt = new Date(lastDecay + consumedMs).toISOString()

  if (newScore === record.score && newLastDecayAt === record.lastDecayAt) {
    return { next: record, changed: false }
  }

  return {
    next: { ...record, score: newScore, lastDecayAt: newLastDecayAt },
    changed: true,
  }
}

/**
 * Apply a user mark. Always settles outstanding decay first so the
 * delta is layered on top of the up-to-date score.
 *
 * FORGET resets `lastDecayAt` to now so we don't immediately deduct
 * another decay tick on the next read.
 */
export function applyMark<T extends FamiliarityFields>(
  record: T,
  action: MarkAction,
  now: number = Date.now(),
): T {
  const settled = settleDecay(record, now).next
  const nowIso = new Date(now).toISOString()
  const delta = MARK_DELTA[action]
  const newScore = clampScore(settled.score + delta)

  return {
    ...settled,
    score: newScore,
    firstMarkedAt: settled.firstMarkedAt ?? nowIso,
    lastMarkedAt: nowIso,
    // FORGET resets the decay timer; other actions preserve any in-flight gap
    lastDecayAt: action === 'FORGET' ? nowIso : (settled.lastDecayAt ?? nowIso),
  }
}

/** Default values for a brand-new record (Save button — pre-mark). */
export function createInitialFamiliarity(): FamiliarityFields {
  return {
    score: SCORE_MIN,
    firstMarkedAt: null,
    lastMarkedAt: null,
    lastDecayAt: null,
  }
}

/** CSS class suffix for a given level (used by the highlight stylesheet). */
export function levelClassSuffix(level: FamiliarityLevel): string {
  return level.toLowerCase()
}

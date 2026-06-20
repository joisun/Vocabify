import Dexie, { type EntityTable } from 'dexie'
import {
  applyMark,
  createInitialFamiliarity,
  type FamiliarityFields,
  type MarkAction,
  getLocalReviewDate,
  getMemoryHorizonDays,
  normalizeMemoryCurve,
  settleDecay,
} from '@/lib/familiarity'
import type { VocabResponse } from '@/lib/aiSchema'
import {
  normalizeWordOrPhrase,
  responseToPayload,
  type NewVocabPayload,
  type PosType,
  type VocabRecord,
  type VocabSense,
  type VocabTombstone,
} from '@/lib/vocabTypes'

export {
  normalizeWordOrPhrase,
  responseToPayload,
  type NewVocabPayload,
  type PosType,
  type VocabRecord,
  type VocabSense,
  type VocabTombstone,
} from '@/lib/vocabTypes'

class VocabifyDatabase extends Dexie {
  records!: EntityTable<VocabRecord, 'id'>
  syncTombstones!: EntityTable<VocabTombstone, 'wordOrPhrase'>

  constructor() {
    super('VocabifyIndexDB')

    // Legacy versions kept so existing users' upgrade path doesn't crash
    this.version(1).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
    })
    this.version(2).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
      records: '++id, wordOrPhrase, createdAt, updatedAt',
    })
    this.version(3).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
      records: '++id, wordOrPhrase, createdAt, updatedAt',
      syncTombstones: 'wordOrPhrase, deletedAt',
    })
    this.version(4).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
      records: '++id, wordOrPhrase, createdAt, updatedAt, score',
      syncTombstones: 'wordOrPhrase, deletedAt',
    })

    // v5: structured schema. Clear legacy records — user accepted the wipe.
    this.version(5).stores({
      records: '++id, wordOrPhrase, createdAt, updatedAt, score',
      syncTombstones: 'wordOrPhrase, deletedAt',
      // dataStore intentionally dropped
    }).upgrade(async (tx) => {
      // Wipe legacy records; new structured records will be created via saveRecord.
      await tx.table('records').clear()
    })

    this.version(6).stores({
      records: '++id, wordOrPhrase, createdAt, updatedAt, score',
      syncTombstones: 'wordOrPhrase, deletedAt',
    }).upgrade(async (tx) => {
      const table = tx.table('records')
      const records = await table.toArray()
      await Promise.all(records.map((record) => {
        const normalized = withFamiliarityDefaults(record as Partial<VocabRecord>)
        if ((record as VocabRecord).id == null) return Promise.resolve()
        return table.update((record as VocabRecord).id!, {
          score: normalized.score,
          firstMarkedAt: normalized.firstMarkedAt,
          lastMarkedAt: normalized.lastMarkedAt,
          lastDecayAt: normalized.lastDecayAt,
          memoryAnchorScore: normalized.memoryAnchorScore,
          memoryAnchorAt: normalized.memoryAnchorAt,
          memoryHorizonDays: normalized.memoryHorizonDays,
          memoryCurve: normalized.memoryCurve,
        })
      }))
    })

    this.version(7).stores({
      records: '++id, wordOrPhrase, createdAt, updatedAt, score',
      syncTombstones: 'wordOrPhrase, deletedAt',
    }).upgrade(async (tx) => {
      const table = tx.table('records')
      const records = await table.toArray()
      await Promise.all(records.map((record) => {
        const normalized = withFamiliarityDefaults(record as Partial<VocabRecord>)
        if ((record as VocabRecord).id == null) return Promise.resolve()
        return table.update((record as VocabRecord).id!, {
          lastReviewDate: normalized.lastReviewDate,
          lastReviewAction: normalized.lastReviewAction,
          dailyReviewBaseScore: normalized.dailyReviewBaseScore,
        })
      }))
    })
  }
}

export const db = new VocabifyDatabase()

function nextSenseId(index: number): string {
  return `s${index + 1}`
}

/** Build a fresh VocabRecord from a structured AI payload + page metadata. */
function buildRecord(payload: NewVocabPayload, now: string): Omit<VocabRecord, 'id'> {
  return {
    wordOrPhrase: normalizeWordOrPhrase(payload.term),
    term: payload.term.trim(),
    phonetic: payload.phonetic.trim(),
    pos: payload.pos,
    senses: payload.senses.map((s, i) => ({
      id: nextSenseId(i),
      definition: s.definition,
      example: s.example,
      exampleTranslation: s.exampleTranslation,
    })),
    mnemonic: payload.mnemonic,
    tags: payload.tags ?? [],
    sourceUrl: payload.sourceUrl,
    sourceContext: payload.sourceContext,
    createdAt: now,
    updatedAt: now,
    ...createInitialFamiliarity(),
  }
}

export async function saveRecord(payload: NewVocabPayload): Promise<{
  record: VocabRecord
  created: boolean
}> {
  const key = normalizeWordOrPhrase(payload.term)
  const now = new Date().toISOString()
  const existing = await db.records.where('wordOrPhrase').equals(key).first()

  if (existing) {
    const updated: Partial<VocabRecord> = {
      term: payload.term.trim(),
      phonetic: payload.phonetic.trim(),
      pos: payload.pos,
      senses: payload.senses.map((s, i) => ({
        id: nextSenseId(i),
        definition: s.definition,
        example: s.example,
        exampleTranslation: s.exampleTranslation,
      })),
      mnemonic: payload.mnemonic,
      tags: payload.tags ?? existing.tags,
      sourceUrl: payload.sourceUrl,
      sourceContext: payload.sourceContext,
      updatedAt: now,
    }
    await db.records.update(existing.id!, updated)
    await db.syncTombstones.delete(key)
    return { record: { ...existing, ...updated } as VocabRecord, created: false }
  }

  const newRecord = buildRecord(payload, now)
  const id = await db.records.add(newRecord as VocabRecord)
  await db.syncTombstones.delete(key)
  return { record: { ...newRecord, id } as VocabRecord, created: true }
}

/** Persist arbitrary field edits from the inline edit mode. */
export async function updateRecordFields(
  id: number,
  patch: Partial<Omit<VocabRecord, 'id' | 'wordOrPhrase' | 'createdAt'>>,
): Promise<VocabRecord | null> {
  const now = new Date().toISOString()
  const merged = { ...patch, updatedAt: now }
  await db.records.update(id, merged)
  const next = await db.records.get(id)
  return next ?? null
}

/** Save the structured AI response to a brand-new record. Convenience wrapper. */
export async function saveFromAiResponse(
  ai: VocabResponse,
  meta: { sourceUrl: string; sourceContext: string; tags?: string[] },
) {
  return saveRecord(responseToPayload(ai, meta))
}

export async function deleteRecord(wordOrPhrase: string) {
  const key = normalizeWordOrPhrase(wordOrPhrase)
  await db.records.where('wordOrPhrase').equals(key).delete()
  await db.syncTombstones.put({
    wordOrPhrase: key,
    deletedAt: new Date().toISOString(),
  })
}

export async function deleteRecordById(id: number) {
  const record = await db.records.get(id)
  if (!record) return
  await deleteRecord(record.wordOrPhrase)
}

export async function getAllRecords() {
  const records = await db.records.orderBy('updatedAt').reverse().toArray()
  return records.map((record) => settleDecay(record).next)
}

export async function countRecords() {
  return db.records.count()
}

export async function getRecordById(id: number) {
  const record = await db.records.get(id)
  return record ? settleAndPersistDecay(record) : null
}

export async function settleRecordById(id: number, now: number = Date.now()) {
  const record = await db.records.get(id)
  return record ? settleAndPersistDecay(record, now) : null
}

export async function getRecordByWord(wordOrPhrase: string) {
  const key = normalizeWordOrPhrase(wordOrPhrase)
  if (!key) return null
  const record = await db.records.where('wordOrPhrase').equals(key).first()
  return record ? settleAndPersistDecay(record) : null
}

export async function searchRecords(keyword: string) {
  const lowerKeyword = keyword.toLowerCase()
  const records = await db.records
    .filter((r) =>
      r.wordOrPhrase.includes(lowerKeyword) ||
      r.term.toLowerCase().includes(lowerKeyword) ||
      r.senses.some((s) => s.definition.toLowerCase().includes(lowerKeyword)),
    )
    .toArray()
  return records.map((record) => settleDecay(record).next)
}

export async function getRecordByPage(pageNum: number, pageSize: number) {
  const total = await db.records.count()
  const records = await db.records
    .orderBy('updatedAt')
    .reverse()
    .offset((pageNum - 1) * pageSize)
    .limit(pageSize)
    .toArray()

  return {
    records: records.map((record) => settleDecay(record).next),
    total: Math.ceil(total / pageSize),
  }
}

export function withFamiliarityDefaults<T extends Partial<FamiliarityFields>>(
  record: T,
): T & FamiliarityFields {
  const score = typeof record.score === 'number' ? record.score : 0
  const anchorAt = normalizeOptionalDate(record.memoryAnchorAt)
    || normalizeOptionalDate(record.lastMarkedAt)
    || normalizeOptionalDate(record.lastDecayAt)
    || null
  return {
    ...record,
    score,
    firstMarkedAt: record.firstMarkedAt ?? null,
    lastMarkedAt: record.lastMarkedAt ?? null,
    lastDecayAt: record.lastDecayAt ?? null,
    memoryAnchorScore: typeof record.memoryAnchorScore === 'number' ? record.memoryAnchorScore : score,
    memoryAnchorAt: anchorAt,
    memoryHorizonDays: typeof record.memoryHorizonDays === 'number' ? record.memoryHorizonDays : getMemoryHorizonDays(score),
    memoryCurve: normalizeMemoryCurve(record.memoryCurve),
    lastReviewDate: normalizeReviewDate(record.lastReviewDate),
    lastReviewAction: isMarkAction(record.lastReviewAction) ? record.lastReviewAction : null,
    dailyReviewBaseScore: typeof record.dailyReviewBaseScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(record.dailyReviewBaseScore)))
      : null,
  }
}

export async function settleAndPersistDecay(
  record: VocabRecord,
  now: number = Date.now(),
): Promise<VocabRecord> {
  const result = settleDecay(record, now)
  if (!result.changed || record.id == null) return result.next
  await db.records.update(record.id, {
    score: result.next.score,
    lastDecayAt: result.next.lastDecayAt,
    memoryAnchorScore: result.next.memoryAnchorScore,
    memoryAnchorAt: result.next.memoryAnchorAt,
    memoryHorizonDays: result.next.memoryHorizonDays,
    memoryCurve: result.next.memoryCurve,
  })
  return result.next
}

export async function markRecord(
  id: number,
  action: MarkAction,
  now: number = Date.now(),
): Promise<VocabRecord | null> {
  const record = await db.records.get(id)
  if (!record) return null
  const normalized = withFamiliarityDefaults(record)
  const reviewDate = getLocalReviewDate(now)
  if (normalized.lastReviewDate === reviewDate && normalized.lastReviewAction === action) {
    return settleDecay(normalized as VocabRecord, now).next
  }

  const next = applyMark(normalized, action, now)
  await db.records.update(id, {
    score: next.score,
    firstMarkedAt: next.firstMarkedAt,
    lastMarkedAt: next.lastMarkedAt,
    lastDecayAt: next.lastDecayAt,
    memoryAnchorScore: next.memoryAnchorScore,
    memoryAnchorAt: next.memoryAnchorAt,
    memoryHorizonDays: next.memoryHorizonDays,
    memoryCurve: next.memoryCurve,
    lastReviewDate: next.lastReviewDate,
    lastReviewAction: next.lastReviewAction,
    dailyReviewBaseScore: next.dailyReviewBaseScore,
    updatedAt: new Date(now).toISOString(),
  })
  return { ...record, ...next, updatedAt: new Date(now).toISOString() }
}

export async function exportVocabularyPayload() {
  const records = await db.records.toArray()
  const tombstones = await db.syncTombstones.toArray()
  return {
    records: records.map((record) => stripRecordId(settleDecay(withFamiliarityDefaults(record)).next)),
    tombstones,
  }
}

export async function importVocabularyPayload(payload: {
  records?: Array<Partial<VocabRecord>>
  tombstones?: Array<Partial<VocabTombstone>>
}) {
  const records = normalizeImportRecords(payload.records || [])
  const tombstones = normalizeImportTombstones(payload.tombstones || [])
  const existing = await db.records.toArray()
  const existingByKey = new Map(existing.map((record) => [normalizeWordOrPhrase(record.wordOrPhrase), record]))

  await db.transaction('rw', db.records, db.syncTombstones, async () => {
    for (const record of records) {
      const existingTombstone = await db.syncTombstones.get(record.wordOrPhrase)
      if (existingTombstone && existingTombstone.deletedAt >= record.updatedAt) {
        continue
      }

      const existingRecord = existingByKey.get(record.wordOrPhrase)
      if (existingRecord?.id) {
        if (record.updatedAt >= existingRecord.updatedAt) {
          await db.records.update(existingRecord.id, record)
          existingByKey.set(record.wordOrPhrase, { ...existingRecord, ...record })
        }
      } else {
        const id = await db.records.add(record)
        existingByKey.set(record.wordOrPhrase, { ...record, id })
      }
      await db.syncTombstones.delete(record.wordOrPhrase)
    }

    for (const tombstone of tombstones) {
      const currentRecord = await db.records.where('wordOrPhrase').equals(tombstone.wordOrPhrase).first()
      if (currentRecord && tombstone.deletedAt < currentRecord.updatedAt) {
        continue
      }
      if (currentRecord?.id && tombstone.deletedAt >= currentRecord.updatedAt) {
        await db.records.delete(currentRecord.id)
        existingByKey.delete(tombstone.wordOrPhrase)
      }
      const existingTombstone = await db.syncTombstones.get(tombstone.wordOrPhrase)
      if (!existingTombstone || tombstone.deletedAt >= existingTombstone.deletedAt) {
        await db.syncTombstones.put(tombstone)
      }
    }
  })

  return {
    recordCount: records.length,
    tombstoneCount: tombstones.length,
  }
}

export async function replaceVocabularyPayload(payload: {
  records?: Array<Partial<VocabRecord>>
  tombstones?: Array<Partial<VocabTombstone>>
}) {
  const records = normalizeImportRecords(payload.records || [])
  const tombstones = normalizeImportTombstones(payload.tombstones || [])

  await db.transaction('rw', db.records, db.syncTombstones, async () => {
    await db.records.clear()
    if (records.length > 0) await db.records.bulkAdd(records as VocabRecord[])
    await db.syncTombstones.clear()
    if (tombstones.length > 0) await db.syncTombstones.bulkPut(tombstones)
  })

  return {
    recordCount: records.length,
    tombstoneCount: tombstones.length,
  }
}

function stripRecordId(record: VocabRecord): Omit<VocabRecord, 'id'> {
  const { id: _id, ...withoutId } = record
  return withoutId
}

function normalizeImportRecords(records: Array<Partial<VocabRecord>>): Array<Omit<VocabRecord, 'id'>> {
  return records
    .map((record): Omit<VocabRecord, 'id'> | null => {
      const wordOrPhrase = normalizeWordOrPhrase(String(record.wordOrPhrase || record.term || ''))
      const term = String(record.term || record.wordOrPhrase || '').trim()
      if (!wordOrPhrase || !term) return null
      const senses = Array.isArray(record.senses) ? record.senses
        .map((sense, index): VocabSense | null => {
          if (!sense) return null
          const definition = String(sense.definition || '').trim()
          if (!definition) return null
          return {
            id: typeof sense.id === 'string' ? sense.id : `s${index + 1}`,
            definition,
            example: String(sense.example || '').trim(),
            exampleTranslation: String(sense.exampleTranslation || '').trim(),
          }
        })
        .filter((sense): sense is VocabSense => sense !== null)
        .slice(0, 3) : []
      if (senses.length === 0) return null

      const now = new Date().toISOString()
      const createdAt = normalizeDate(record.createdAt, record.updatedAt || now)
      const updatedAt = normalizeDate(record.updatedAt, createdAt)
      const { id: _id, ...familiarity } = withFamiliarityDefaults(record)
      return {
        ...familiarity,
        wordOrPhrase,
        term,
        phonetic: String(record.phonetic || '').trim(),
        pos: isPosType(record.pos) ? record.pos : 'other',
        senses,
        mnemonic: String(record.mnemonic || '').trim(),
        tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        sourceUrl: String(record.sourceUrl || '').trim(),
        sourceContext: String(record.sourceContext || '').trim(),
        createdAt,
        updatedAt,
      }
    })
    .filter((record): record is Omit<VocabRecord, 'id'> => record !== null)
}

function normalizeImportTombstones(tombstones: Array<Partial<VocabTombstone>>): VocabTombstone[] {
  return tombstones
    .map((tombstone) => {
      const wordOrPhrase = normalizeWordOrPhrase(String(tombstone.wordOrPhrase || ''))
      if (!wordOrPhrase) return null
      return {
        wordOrPhrase,
        deletedAt: normalizeDate(tombstone.deletedAt),
      }
    })
    .filter((tombstone): tombstone is VocabTombstone => tombstone !== null)
}

function isPosType(value: unknown): value is PosType {
  return value === 'n'
    || value === 'v'
    || value === 'adj'
    || value === 'adv'
    || value === 'phrase'
    || value === 'other'
}

function normalizeDate(primary?: string | null, fallback?: string | null) {
  const value = primary || fallback
  if (value && !Number.isNaN(new Date(value).getTime())) return new Date(value).toISOString()
  return new Date().toISOString()
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function normalizeReviewDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

function isMarkAction(value: unknown): value is MarkAction {
  return value === 'KNOW' || value === 'FUZZY' || value === 'FORGET'
}

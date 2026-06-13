import Dexie, { type EntityTable } from 'dexie'
import {
  applyMark,
  clampScore,
  createInitialFamiliarity,
  type FamiliarityFields,
  type MarkAction,
  settleDecay,
} from '@/lib/familiarity'

export interface VocabRecord extends FamiliarityFields {
  id?: number
  wordOrPhrase: string
  meaning: string
  createdAt: string
  updatedAt: string
}

export interface VocabTombstone {
  wordOrPhrase: string
  deletedAt: string
}

class VocabifyDatabase extends Dexie {
  records!: EntityTable<VocabRecord, 'id'>
  syncTombstones!: EntityTable<VocabTombstone, 'wordOrPhrase'>

  constructor() {
    super('VocabifyIndexDB')

    // Version 1: Original schema (for migration compatibility)
    this.version(1).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
    })

    // Version 2: New schema with migration
    this.version(2).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
      records: '++id, wordOrPhrase, createdAt, updatedAt',
    }).upgrade(async tx => {
      // Migrate existing data from dataStore to records
      const oldData = await tx.table('dataStore').toArray()
      if (oldData.length > 0) {
        await tx.table('records').bulkAdd(oldData)
      }
    })

    // Version 3: Track deletions so GitHub sync can propagate removals.
    this.version(3).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
      records: '++id, wordOrPhrase, createdAt, updatedAt',
      syncTombstones: 'wordOrPhrase, deletedAt',
    })

    // Version 4: Familiarity scoring fields. Backfill defaults on existing rows
    // so the UI can read score / decay markers without null checks.
    this.version(4).stores({
      dataStore: '++id, wordOrPhrase, createdAt, updatedAt',
      records: '++id, wordOrPhrase, createdAt, updatedAt, score',
      syncTombstones: 'wordOrPhrase, deletedAt',
    }).upgrade(async tx => {
      await tx.table('records').toCollection().modify((record: VocabRecord) => {
        if (typeof record.score !== 'number') record.score = 0
        if (record.firstMarkedAt === undefined) record.firstMarkedAt = null
        if (record.lastMarkedAt === undefined) record.lastMarkedAt = null
        if (record.lastDecayAt === undefined) record.lastDecayAt = null
      })
    })
  }
}

export const db = new VocabifyDatabase()

export function normalizeWordOrPhrase(wordOrPhrase: string) {
  return wordOrPhrase.trim().toLowerCase()
}

/** Coerce a record loaded from any source (Dexie, GitHub, legacy) to include familiarity fields. */
export function withFamiliarityDefaults<T extends Partial<FamiliarityFields>>(record: T): T & FamiliarityFields {
  return {
    ...record,
    score: clampScore(typeof record.score === 'number' ? record.score : 0),
    firstMarkedAt: record.firstMarkedAt ?? null,
    lastMarkedAt: record.lastMarkedAt ?? null,
    lastDecayAt: record.lastDecayAt ?? null,
  }
}

export async function saveRecord(wordOrPhrase: string, meaning: string) {
  const key = normalizeWordOrPhrase(wordOrPhrase)
  const existing = await db.records.where('wordOrPhrase').equals(key).first()

  if (existing) {
    await db.records.update(existing.id!, {
      meaning,
      updatedAt: new Date().toISOString()
    })
    await db.syncTombstones.delete(key)
    return { title: 'Updated 🔄✨✨', detail: 'Already existed, Update to new data!' }
  }

  await db.records.add({
    wordOrPhrase: key,
    meaning,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...createInitialFamiliarity(),
  })
  await db.syncTombstones.delete(key)
  return { title: 'Done 🥳🎉🎉', detail: 'Data added successfully!' }
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
  return db.records.orderBy('updatedAt').reverse().toArray()
}

export async function searchRecords(keyword: string) {
  const lowerKeyword = keyword.toLowerCase()
  return db.records.filter(r => r.wordOrPhrase.includes(lowerKeyword)).toArray()
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
    records,
    total: Math.ceil(total / pageSize)
  }
}

/**
 * Settle outstanding decay for a single record and persist if anything changed.
 * Used right before highlighting paints a word so its color reflects the latest state.
 */
export async function settleAndPersistDecay(record: VocabRecord, now: number = Date.now()): Promise<VocabRecord> {
  const result = settleDecay(record, now)
  if (!result.changed || record.id == null) return result.next
  await db.records.update(record.id, {
    score: result.next.score,
    lastDecayAt: result.next.lastDecayAt,
  })
  return result.next
}

/** Apply a Know / Fuzzy / Forget mark to a stored record and persist the result. */
export async function markRecord(id: number, action: MarkAction, now: number = Date.now()): Promise<VocabRecord | null> {
  const record = await db.records.get(id)
  if (!record) return null
  const next = applyMark(record, action, now)
  await db.records.update(id, {
    score: next.score,
    firstMarkedAt: next.firstMarkedAt,
    lastMarkedAt: next.lastMarkedAt,
    lastDecayAt: next.lastDecayAt,
    updatedAt: new Date(now).toISOString(),
  })
  return { ...record, ...next, updatedAt: new Date(now).toISOString() }
}

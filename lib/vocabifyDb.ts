import Dexie, { type EntityTable } from 'dexie'
import {
  applyMark,
  createInitialFamiliarity,
  type FamiliarityFields,
  type MarkAction,
  settleDecay,
} from '@/lib/familiarity'
import type { VocabResponse, VocabSense as AiVocabSense } from '@/lib/aiSchema'

export type PosType = 'n' | 'v' | 'adj' | 'adv' | 'phrase' | 'other'

export interface VocabSense {
  id: string
  definition: string
  example: string
  exampleTranslation: string
}

export interface VocabRecord extends FamiliarityFields {
  id?: number
  wordOrPhrase: string         // normalized key (lowercased trimmed)
  term: string                 // display form preserving casing
  phonetic: string
  pos: PosType
  senses: VocabSense[]
  mnemonic: string
  tags: string[]
  sourceUrl: string
  sourceContext: string
  createdAt: string
  updatedAt: string
}

export interface VocabTombstone {
  wordOrPhrase: string
  deletedAt: string
}

/** New record payload — what saveRecord accepts from AI response + page metadata */
export interface NewVocabPayload {
  term: string
  phonetic: string
  pos: PosType
  senses: AiVocabSense[]
  mnemonic: string
  tags?: string[]
  sourceUrl: string
  sourceContext: string
}

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
  }
}

export const db = new VocabifyDatabase()

export function normalizeWordOrPhrase(wordOrPhrase: string) {
  return wordOrPhrase.trim().toLowerCase()
}

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
  return saveRecord({
    term: ai.term,
    phonetic: ai.phonetic,
    pos: ai.pos,
    senses: ai.senses,
    mnemonic: ai.mnemonic,
    tags: meta.tags,
    sourceUrl: meta.sourceUrl,
    sourceContext: meta.sourceContext,
  })
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
  return db.records
    .filter((r) =>
      r.wordOrPhrase.includes(lowerKeyword) ||
      r.term.toLowerCase().includes(lowerKeyword) ||
      r.senses.some((s) => s.definition.toLowerCase().includes(lowerKeyword)),
    )
    .toArray()
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
    total: Math.ceil(total / pageSize),
  }
}

export function withFamiliarityDefaults<T extends Partial<FamiliarityFields>>(
  record: T,
): T & FamiliarityFields {
  return {
    ...record,
    score: typeof record.score === 'number' ? record.score : 0,
    firstMarkedAt: record.firstMarkedAt ?? null,
    lastMarkedAt: record.lastMarkedAt ?? null,
    lastDecayAt: record.lastDecayAt ?? null,
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

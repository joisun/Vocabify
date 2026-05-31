import Dexie, { type EntityTable } from 'dexie'

export interface VocabRecord {
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
  }
}

export const db = new VocabifyDatabase()

export function normalizeWordOrPhrase(wordOrPhrase: string) {
  return wordOrPhrase.trim().toLowerCase()
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
    updatedAt: new Date().toISOString()
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

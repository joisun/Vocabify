import Dexie, { type EntityTable } from 'dexie'

export interface VocabRecord {
  id?: number
  wordOrPhrase: string
  meaning: string
  createdAt: string
  updatedAt: string
}

class VocabifyDatabase extends Dexie {
  records!: EntityTable<VocabRecord, 'id'>

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
  }
}

export const db = new VocabifyDatabase()

export async function saveRecord(wordOrPhrase: string, meaning: string) {
  const key = wordOrPhrase.trim().toLowerCase()
  const existing = await db.records.where('wordOrPhrase').equals(key).first()

  if (existing) {
    await db.records.update(existing.id!, {
      meaning,
      updatedAt: new Date().toISOString()
    })
    return { title: 'Updated 🔄✨✨', detail: 'Already existed, Update to new data!' }
  }

  await db.records.add({
    wordOrPhrase: key,
    meaning,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  return { title: 'Done 🥳🎉🎉', detail: 'Data added successfully!' }
}

export async function deleteRecord(wordOrPhrase: string) {
  const key = wordOrPhrase.trim().toLowerCase()
  await db.records.where('wordOrPhrase').equals(key).delete()
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

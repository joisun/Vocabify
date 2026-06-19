import { sendMessage } from '@/lib/messaging'
import { responseToPayload, type NewVocabPayload, type VocabRecord, type VocabTombstone } from '@/lib/vocabTypes'
import type { MarkAction } from '@/lib/familiarity'
import type { VocabResponse } from '@/lib/aiSchema'

export async function getAllRecords() {
  return sendMessage('vocabGetAll', undefined)
}

export async function countRecords() {
  const result = await sendMessage('vocabCount', undefined)
  return result.count
}

export function searchRecords(keyword: string) {
  return sendMessage('vocabSearch', { keyword })
}

export function getRecordById(id: number) {
  return sendMessage('vocabGetById', { id })
}

export function getRecordByWord(wordOrPhrase: string) {
  return sendMessage('vocabGetByWord', { wordOrPhrase })
}

export function saveRecord(payload: NewVocabPayload) {
  return sendMessage('vocabSave', payload)
}

export function saveFromAiResponse(
  ai: VocabResponse,
  meta: { sourceUrl: string; sourceContext: string; tags?: string[] },
) {
  return saveRecord(responseToPayload(ai, meta))
}

export function updateRecordFields(
  id: number,
  patch: Partial<Omit<VocabRecord, 'id' | 'wordOrPhrase' | 'createdAt'>>,
) {
  return sendMessage('vocabUpdate', { id, patch })
}

export async function deleteRecordById(id: number) {
  await sendMessage('vocabDeleteById', { id })
}

export function markRecord(id: number, action: MarkAction) {
  return sendMessage('vocabMark', { id, action })
}

export function settleRecord(id: number, now?: number) {
  return sendMessage('vocabSettle', { id, now })
}

export function exportVocabularyPayload() {
  return sendMessage('vocabExport', undefined)
}

export function importVocabularyPayload(payload: {
  records: Array<Partial<VocabRecord>>
  tombstones: Array<Partial<VocabTombstone>>
}) {
  return sendMessage('vocabImport', payload)
}

export function replaceVocabularyPayload(payload: {
  records: Array<Partial<VocabRecord>>
  tombstones: Array<Partial<VocabTombstone>>
}) {
  return sendMessage('vocabReplace', payload)
}

import type { VocabResponse, VocabSense as AiVocabSense } from '@/lib/aiSchema'
import type { FamiliarityFields } from '@/lib/familiarity'

export type PosType = 'n' | 'v' | 'adj' | 'adv' | 'phrase' | 'other'

export interface VocabSense {
  id: string
  definition: string
  example: string
  exampleTranslation: string
}

export interface VocabTombstone {
  wordOrPhrase: string
  deletedAt: string
}

export interface VocabRecord extends FamiliarityFields {
  id?: number
  wordOrPhrase: string
  term: string
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

export function normalizeWordOrPhrase(wordOrPhrase: string) {
  return wordOrPhrase.trim().toLowerCase()
}

export function responseToPayload(
  ai: VocabResponse,
  meta: { sourceUrl: string; sourceContext: string; tags?: string[] },
): NewVocabPayload {
  return {
    term: ai.term,
    phonetic: ai.phonetic,
    pos: ai.pos,
    senses: ai.senses,
    mnemonic: ai.mnemonic,
    tags: meta.tags,
    sourceUrl: meta.sourceUrl,
    sourceContext: meta.sourceContext,
  }
}

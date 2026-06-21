import { z } from 'zod'
import {
  getLevel,
  type FamiliarityLevel,
  type MarkAction,
} from '@/lib/familiarity'
import {
  normalizeWordOrPhrase,
  type PosType,
  type VocabRecord,
  type VocabTombstone,
} from '@/lib/vocabTypes'

export const VOCABULARY_EXPORT_SCHEMA_VERSION = 2

export type VocabularyExportPayload = {
  schemaVersion: 2
  updatedAt: string
  records: Array<Omit<VocabRecord, 'id'>>
  tombstones: VocabTombstone[]
}

export type VocabularyImportDryRun = {
  valid: boolean
  schemaVersion: number | null
  recordCount: number
  tombstoneCount: number
  invalidEntryCount: number
  errors: string[]
  payload?: VocabularyExportPayload
}

const VALID_POS: PosType[] = ['n', 'v', 'adj', 'adv', 'phrase', 'other']
const VALID_MARK_ACTIONS: MarkAction[] = ['KNOW', 'FUZZY', 'FORGET']

const isoDateSchema = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Expected a valid ISO date string',
})
const nullableIsoDateSchema = z.union([isoDateSchema, z.null()])
const reviewDateSchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
const markActionSchema = z.union([z.enum(VALID_MARK_ACTIONS), z.null()])
const posSchema = z.enum(VALID_POS)
const scoreSchema = z.number().int().min(0).max(100)
const unitSchema = z.number().min(0).max(1)

const memoryCurveSchema = z.object({
  x1: unitSchema,
  y1: unitSchema,
  x2: unitSchema,
  y2: unitSchema,
}).strict()

const senseSchema = z.object({
  id: z.string().min(1),
  definition: z.string().min(1),
  example: z.string(),
  exampleTranslation: z.string(),
}).strict()

const recordSchema = z.object({
  wordOrPhrase: z.string().min(1),
  term: z.string().min(1),
  phonetic: z.string(),
  pos: posSchema,
  senses: z.array(senseSchema).min(1).max(3),
  mnemonic: z.string(),
  tags: z.array(z.string()),
  sourceUrl: z.string(),
  sourceContext: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  score: scoreSchema,
  firstMarkedAt: nullableIsoDateSchema,
  lastMarkedAt: nullableIsoDateSchema,
  lastDecayAt: nullableIsoDateSchema,
  memoryAnchorScore: scoreSchema,
  memoryAnchorAt: nullableIsoDateSchema,
  memoryHorizonDays: z.number().min(0),
  memoryCurve: memoryCurveSchema,
  lastReviewDate: reviewDateSchema,
  lastReviewAction: markActionSchema,
  dailyReviewBaseScore: z.union([scoreSchema, z.null()]),
}).strict().superRefine((record, ctx) => {
  if (record.wordOrPhrase !== normalizeWordOrPhrase(record.wordOrPhrase)) {
    ctx.addIssue({
      code: 'custom',
      path: ['wordOrPhrase'],
      message: 'wordOrPhrase must already be normalized',
    })
  }
})

const tombstoneSchema = z.object({
  wordOrPhrase: z.string().min(1),
  deletedAt: isoDateSchema,
}).strict().superRefine((tombstone, ctx) => {
  if (tombstone.wordOrPhrase !== normalizeWordOrPhrase(tombstone.wordOrPhrase)) {
    ctx.addIssue({
      code: 'custom',
      path: ['wordOrPhrase'],
      message: 'wordOrPhrase must already be normalized',
    })
  }
})

export function createVocabularyExportPayload(payload: {
  records: Array<Omit<VocabRecord, 'id'>>
  tombstones: VocabTombstone[]
}, now: string = new Date().toISOString()): VocabularyExportPayload {
  return {
    schemaVersion: VOCABULARY_EXPORT_SCHEMA_VERSION,
    updatedAt: now,
    records: payload.records,
    tombstones: payload.tombstones,
  }
}

export function validateVocabularyImportJson(text: string): VocabularyImportDryRun {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return invalidDryRun([error instanceof Error ? error.message : 'Invalid JSON'])
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalidDryRun(['Import file must be a JSON object.'])
  }

  const input = parsed as Record<string, unknown>
  const errors: string[] = []
  const schemaVersion = typeof input.schemaVersion === 'number' ? input.schemaVersion : null
  if (schemaVersion !== VOCABULARY_EXPORT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${VOCABULARY_EXPORT_SCHEMA_VERSION}.`)
  }
  if (typeof input.updatedAt !== 'string' || Number.isNaN(new Date(input.updatedAt).getTime())) {
    errors.push('updatedAt must be a valid ISO date string.')
  }
  if (!Array.isArray(input.records)) errors.push('records must be an array.')
  if (!Array.isArray(input.tombstones)) errors.push('tombstones must be an array.')

  const rawRecords = Array.isArray(input.records) ? input.records : []
  const rawTombstones = Array.isArray(input.tombstones) ? input.tombstones : []
  const records: Array<Omit<VocabRecord, 'id'>> = []
  const tombstones: VocabTombstone[] = []
  let invalidEntryCount = 0

  rawRecords.forEach((record, index) => {
    const result = recordSchema.safeParse(record)
    if (result.success) {
      records.push(result.data)
      return
    }
    invalidEntryCount += 1
    errors.push(`records[${index}]: ${formatZodError(result.error)}`)
  })

  rawTombstones.forEach((tombstone, index) => {
    const result = tombstoneSchema.safeParse(tombstone)
    if (result.success) {
      tombstones.push(result.data)
      return
    }
    invalidEntryCount += 1
    errors.push(`tombstones[${index}]: ${formatZodError(result.error)}`)
  })

  if (errors.length > 0 || invalidEntryCount > 0) {
    return {
      valid: false,
      schemaVersion,
      recordCount: records.length,
      tombstoneCount: tombstones.length,
      invalidEntryCount,
      errors: limitErrors(errors),
    }
  }

  return {
    valid: true,
    schemaVersion: VOCABULARY_EXPORT_SCHEMA_VERSION,
    recordCount: records.length,
    tombstoneCount: tombstones.length,
    invalidEntryCount: 0,
    errors: [],
    payload: {
      schemaVersion: VOCABULARY_EXPORT_SCHEMA_VERSION,
      updatedAt: new Date(input.updatedAt as string).toISOString(),
      records,
      tombstones,
    },
  }
}

export function createVocabularyCsv(records: Array<Omit<VocabRecord, 'id'>>) {
  const headers = [
    'term',
    'phonetic',
    'pos',
    'definition',
    'example',
    'exampleTranslation',
    'mnemonic',
    'score',
    'dueAt',
    'tags',
    'sourceUrl',
    'updatedAt',
  ]
  const rows = records.map((record) => [
    record.term,
    record.phonetic,
    record.pos,
    joinSenses(record, 'definition'),
    joinSenses(record, 'example'),
    joinSenses(record, 'exampleTranslation'),
    record.mnemonic,
    String(record.score),
    getApproxDueAt(record),
    record.tags.join('; '),
    record.sourceUrl,
    record.updatedAt,
  ])
  return toCsv([headers, ...rows])
}

export function createAnkiCsv(records: Array<Omit<VocabRecord, 'id'>>) {
  const headers = ['Front', 'Back', 'Tags']
  const rows = records.map((record) => {
    const front = [record.term, record.phonetic].filter(Boolean).join('\n')
    const back = [
      joinSenses(record, 'definition'),
      joinSenses(record, 'example'),
      joinSenses(record, 'exampleTranslation'),
      record.mnemonic ? `Mnemonic: ${record.mnemonic}` : '',
    ].filter(Boolean).join('\n\n')
    return [
      front,
      back,
      buildAnkiTags(record),
    ]
  })
  return toCsv([headers, ...rows])
}

export function stringifyVocabularyJson(payload: VocabularyExportPayload) {
  return JSON.stringify(payload, null, 2)
}

function invalidDryRun(errors: string[]): VocabularyImportDryRun {
  return {
    valid: false,
    schemaVersion: null,
    recordCount: 0,
    tombstoneCount: 0,
    invalidEntryCount: 0,
    errors,
  }
}

function formatZodError(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'entry'
      return `${path} ${issue.message}`
    })
    .join('; ')
}

function limitErrors(errors: string[]) {
  if (errors.length <= 8) return errors
  return [...errors.slice(0, 8), `${errors.length - 8} more validation errors hidden.`]
}

function joinSenses(record: Omit<VocabRecord, 'id'>, key: 'definition' | 'example' | 'exampleTranslation') {
  return record.senses
    .map((sense, index) => {
      const value = sense[key].trim()
      return value ? `${index + 1}. ${value}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function getApproxDueAt(record: Omit<VocabRecord, 'id'>) {
  if (!record.memoryAnchorAt || !record.memoryHorizonDays) return ''
  const anchorTime = new Date(record.memoryAnchorAt).getTime()
  if (Number.isNaN(anchorTime)) return ''
  return new Date(anchorTime + record.memoryHorizonDays * 86_400_000).toISOString()
}

function buildAnkiTags(record: Omit<VocabRecord, 'id'>) {
  const tags = [
    'vocabify',
    `pos_${record.pos}`,
    `level_${levelTag(getLevel(record.score))}`,
    ...record.tags,
  ]
  return Array.from(new Set(tags.map(toAnkiTag).filter(Boolean))).join(' ')
}

function levelTag(level: FamiliarityLevel) {
  return level.toLowerCase()
}

function toAnkiTag(value: string) {
  return value.trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_:-]/gu, '')
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

function escapeCsvCell(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return `"${normalized.replace(/"/g, '""')}"`
}

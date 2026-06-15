import { z } from 'zod'

const posValues = ['n', 'v', 'adj', 'adv', 'phrase', 'other'] as const

function normalizePos(value: unknown): typeof posValues[number] {
  if (typeof value !== 'string') return 'other'

  const normalized = value.trim().toLowerCase().replace(/\.$/, '')
  const aliases: Record<string, typeof posValues[number]> = {
    n: 'n',
    noun: 'n',
    v: 'v',
    verb: 'v',
    adj: 'adj',
    adjective: 'adj',
    adv: 'adv',
    adverb: 'adv',
    phrase: 'phrase',
    phr: 'phrase',
    idiom: 'phrase',
    expression: 'phrase',
    other: 'other',
  }

  return aliases[normalized] ?? 'other'
}

export const vocabSenseSchema = z.object({
  definition: z.string().catch(''),
  example: z.string().catch(''),
  exampleTranslation: z.string().catch(''),
})

export const vocabResponseSchema = z.object({
  term: z.string().catch(''),
  phonetic: z.string().catch(''),
  pos: z.preprocess(normalizePos, z.enum(posValues)),
  senses: z.array(vocabSenseSchema).min(1).max(3).catch([]),
  mnemonic: z.string().catch(''),
})

export type VocabSense = z.infer<typeof vocabSenseSchema>
export type VocabResponse = z.infer<typeof vocabResponseSchema>

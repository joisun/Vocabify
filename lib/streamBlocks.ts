import type { VocabResponse } from '@/lib/aiSchema'

type PosType = VocabResponse['pos']

type BlockTag = 'term' | 'phonetic' | 'pos' | 'definition' | 'example' | 'exampleTranslation' | 'mnemonic'

const scalarTags = ['term', 'phonetic', 'pos', 'mnemonic'] as const
const senseTags = ['definition', 'example', 'exampleTranslation'] as const
const allTags = [...scalarTags, ...senseTags] as const

export function parseVocabBlockStream(raw: string): {
  partial: Partial<VocabResponse>
  complete: boolean
} {
  const source = stripCodeFence(raw)
  const partial: Partial<VocabResponse> = {}

  for (const tag of scalarTags) {
    const value = readLatestTagText(source, tag)
    if (!value) continue
    if (tag === 'pos') {
      const pos = normalizePos(value)
      if (pos) partial.pos = pos
    } else {
      partial[tag] = value
    }
  }

  const senses = readSenseBlocks(source)
  if (senses.length) partial.senses = senses

  return {
    partial,
    complete: hasClosingTag(source, 'vocabify'),
  }
}

export function blockPartialToResponse(partial: Partial<VocabResponse>): VocabResponse {
  return {
    term: partial.term || '',
    phonetic: partial.phonetic || '',
    pos: partial.pos || 'other',
    senses: normalizeSenses(partial.senses),
    mnemonic: partial.mnemonic || '',
  }
}

function normalizeSenses(senses: Partial<VocabResponse>['senses']) {
  const normalized = (senses || [])
    .map((sense) => ({
      definition: sense.definition || '',
      example: sense.example || '',
      exampleTranslation: sense.exampleTranslation || '',
    }))
    .filter((sense) => sense.definition || sense.example || sense.exampleTranslation)
    .slice(0, 3)

  return normalized.length
    ? normalized
    : [{ definition: '', example: '', exampleTranslation: '' }]
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```(?:xml|html|vocabify|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
}

function readSenseBlocks(source: string): NonNullable<Partial<VocabResponse>['senses']> {
  const byIndex = new Map<number, { definition?: string; example?: string; exampleTranslation?: string }>()

  for (const tag of senseTags) {
    for (const block of readIndexedTagTexts(source, tag)) {
      const current = byIndex.get(block.index) || {}
      current[tag] = block.text
      byIndex.set(block.index, current)
    }
  }

  return Array.from(byIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, sense]) => ({
      definition: sense.definition || '',
      example: sense.example || '',
      exampleTranslation: sense.exampleTranslation || '',
    }))
    .filter((sense) => sense.definition || sense.example || sense.exampleTranslation)
    .slice(0, 3)
}

function readLatestTagText(source: string, tag: BlockTag) {
  const blocks = readIndexedTagTexts(source, tag)
  return blocks[blocks.length - 1]?.text
}

function readIndexedTagTexts(source: string, tag: BlockTag): Array<{ index: number; text: string }> {
  const blocks: Array<{ index: number; text: string }> = []
  let offset = 0

  while (offset < source.length) {
    const open = findOpeningTag(source, tag, offset)
    if (!open) break

    const closeStart = source.indexOf(`</${tag}>`, open.end)
    const textEnd = closeStart >= 0 ? closeStart : source.length
    const text = decodeXmlText(source.slice(open.end, textEnd))
    if (text) blocks.push({ index: open.index, text })

    offset = closeStart >= 0 ? closeStart + tag.length + 3 : source.length
  }

  return blocks
}

function findOpeningTag(source: string, tag: BlockTag, offset: number) {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>`, 'gi')
  pattern.lastIndex = offset
  const match = pattern.exec(source)
  if (!match) return null

  return {
    end: pattern.lastIndex,
    index: readIndexAttribute(match[1] || ''),
  }
}

function readIndexAttribute(attributes: string) {
  const match = /\bindex\s*=\s*(?:"(\d+)"|'(\d+)'|(\d+))/i.exec(attributes)
  const value = match?.[1] || match?.[2] || match?.[3]
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

function hasClosingTag(source: string, tag: string) {
  return new RegExp(`</${tag}>`, 'i').test(source)
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function normalizePos(value: string | undefined): PosType | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase().replace(/\.$/, '')
  const aliases: Record<string, PosType> = {
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

  return aliases[normalized] || 'other'
}

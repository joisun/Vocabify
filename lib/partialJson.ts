import type { VocabResponse } from './aiSchema'

/**
 * 增量解析 AI 流式输出的 JSON，容忍不完整的输入。
 *
 * Fast path keeps exact JSON parsing. Streaming fallback scans fields directly
 * from incomplete JSON text so the UI can update per field, line and text block
 * without ever rendering raw JSON.
 */
export function parsePartialJson(raw: string): {
  partial: Partial<VocabResponse>
  complete: boolean
} {
  const cleaned = normalizeJsonStream(raw)
  if (!cleaned) return { partial: {}, complete: false }

  // 尝试直接解析（如果已经完整）
  try {
    const parsed = JSON.parse(cleaned)
    return { partial: parsed, complete: true }
  } catch {
    // 继续容错解析
  }

  const scanned = scanPartialObject(cleaned)
  const repaired = repairJson(cleaned)
  try {
    const parsed = JSON.parse(repaired)
    return { partial: mergePartial(parsed, scanned), complete: false }
  } catch {
    return { partial: scanned, complete: false }
  }
}

function normalizeJsonStream(raw: string): string {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '')
  cleaned = cleaned.replace(/\s*```$/i, '')

  const start = cleaned.indexOf('{')
  if (start === -1) return ''
  return cleaned.slice(start)
}

function mergePartial(parsed: Partial<VocabResponse>, scanned: Partial<VocabResponse>): Partial<VocabResponse> {
  return {
    ...parsed,
    ...pickFilledScalars(scanned),
    senses: mergeSenses(parsed.senses, scanned.senses),
  }
}

function pickFilledScalars(partial: Partial<VocabResponse>): Partial<VocabResponse> {
  const next: Partial<VocabResponse> = {}
  if (partial.term) next.term = partial.term
  if (partial.phonetic) next.phonetic = partial.phonetic
  if (partial.pos) next.pos = partial.pos
  if (partial.mnemonic) next.mnemonic = partial.mnemonic
  return next
}

function mergeSenses(
  parsed: Partial<VocabResponse>['senses'],
  scanned: Partial<VocabResponse>['senses'],
): Partial<VocabResponse>['senses'] {
  if (!scanned?.length) return parsed
  if (!parsed?.length) return scanned

  return scanned.map((sense, index) => ({
    ...parsed[index],
    ...sense,
  }))
}

function scanPartialObject(source: string): Partial<VocabResponse> {
  const partial: Partial<VocabResponse> = {}

  const term = readStringField(source, 'term')
  const phonetic = readStringField(source, 'phonetic')
  const pos = normalizePos(readStringField(source, 'pos'))
  const mnemonic = readStringField(source, 'mnemonic')
  const senses = readSenses(source)

  if (term) partial.term = term
  if (phonetic) partial.phonetic = phonetic
  if (pos) partial.pos = pos
  if (senses.length) partial.senses = senses
  if (mnemonic) partial.mnemonic = mnemonic

  return partial
}

function readStringField(source: string, field: string): string | undefined {
  const match = new RegExp(`"${field}"\\s*:\\s*"`, 'm').exec(source)
  if (!match) return undefined

  const quoteIndex = match.index + match[0].length - 1
  return readJsonString(source, quoteIndex)
}

function readSenses(source: string): NonNullable<Partial<VocabResponse>['senses']> {
  const match = /"senses"\s*:\s*\[/m.exec(source)
  if (!match) return []

  const objects = readObjectFragments(source.slice(match.index + match[0].length))
  return objects
    .map((fragment) => ({
      definition: readStringField(fragment, 'definition') || '',
      example: readStringField(fragment, 'example') || '',
      exampleTranslation: readStringField(fragment, 'exampleTranslation') || '',
    }))
    .filter((sense) => sense.definition || sense.example || sense.exampleTranslation)
    .slice(0, 3)
}

function readObjectFragments(source: string): string[] {
  const fragments: string[] = []
  let inString = false
  let escape = false
  let depth = 0
  let objectStart = -1

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === ']') break
    if (char === '{') {
      if (depth === 0) objectStart = i
      depth++
      continue
    }
    if (char === '}' && depth > 0) {
      depth--
      if (depth === 0 && objectStart >= 0) {
        fragments.push(source.slice(objectStart, i + 1))
        objectStart = -1
      }
    }
  }

  if (objectStart >= 0) fragments.push(source.slice(objectStart))
  return fragments
}

function readJsonString(source: string, quoteIndex: number): string | undefined {
  let value = ''
  let escape = false

  for (let i = quoteIndex + 1; i < source.length; i++) {
    const char = source[i]

    if (escape) {
      if (char === 'u') {
        const hex = source.slice(i + 1, i + 5)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          value += String.fromCharCode(parseInt(hex, 16))
          i += 4
        } else {
          value += char
        }
      } else {
        value += decodeEscape(char)
      }
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') return value
    value += char
  }

  return value || undefined
}

function decodeEscape(char: string) {
  switch (char) {
    case '"':
    case '\\':
    case '/':
      return char
    case 'b':
      return '\b'
    case 'f':
      return '\f'
    case 'n':
      return '\n'
    case 'r':
      return '\r'
    case 't':
      return '\t'
    default:
      return char
  }
}

function normalizePos(value: string | undefined): VocabResponse['pos'] | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase().replace(/\.$/, '')
  if (normalized === 'noun') return 'n'
  if (normalized === 'verb') return 'v'
  if (normalized === 'adjective') return 'adj'
  if (normalized === 'adverb') return 'adv'
  if (normalized === 'phr' || normalized === 'idiom' || normalized === 'expression') return 'phrase'
  if (['n', 'v', 'adj', 'adv', 'phrase', 'other'].includes(normalized)) {
    return normalized as VocabResponse['pos']
  }
  return 'other'
}

function repairJson(str: string): string {
  let depth = 0
  let inString = false
  let escape = false
  let lastValidPos = 0

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      if (!inString) lastValidPos = i + 1
      continue
    }

    if (inString) continue

    if (char === '{' || char === '[') {
      depth++
      lastValidPos = i + 1
    } else if (char === '}' || char === ']') {
      depth--
      lastValidPos = i + 1
    } else if (char === ',' || char === ':') {
      lastValidPos = i + 1
    }
  }

  // 截取到最后一个有效位置
  let truncated = str.slice(0, lastValidPos).trim()

  // 如果在字符串内部截断，闭合字符串
  if (inString) {
    truncated += '"'
  }

  // 移除尾部的逗号（避免 trailing comma）
  truncated = truncated.replace(/,(\s*)$/, '$1')

  // 闭合未闭合的括号
  const stack: string[] = []
  inString = false
  escape = false

  for (let i = 0; i < truncated.length; i++) {
    const char = truncated[i]

    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') stack.push('}')
    else if (char === '[') stack.push(']')
    else if (char === '}' || char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop()
      }
    }
  }

  // 闭合所有未闭合的括号
  while (stack.length > 0) {
    truncated += stack.pop()
  }

  return truncated
}

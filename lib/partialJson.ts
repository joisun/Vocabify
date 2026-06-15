import type { VocabResponse } from './aiSchema'

/**
 * 增量解析 AI 流式输出的 JSON，容忍不完整的输入
 *
 * 策略：
 * 1. 剥离 markdown code fence 和前导散文
 * 2. 尝试闭合未完成的字符串、数组、对象
 * 3. 返回已解析的部分 + complete 标志
 */
export function parsePartialJson(raw: string): {
  partial: Partial<VocabResponse>
  complete: boolean
} {
  // 剥离 markdown code fence
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  // 找到第一个 { 开始的位置，丢弃之前的散文
  const start = cleaned.indexOf('{')
  if (start === -1) {
    return { partial: {}, complete: false }
  }
  cleaned = cleaned.slice(start)

  // 尝试直接解析（如果已经完整）
  try {
    const parsed = JSON.parse(cleaned)
    return { partial: parsed, complete: true }
  } catch {
    // 继续容错解析
  }

  // 闭合策略：逐层检查括号平衡
  const repaired = repairJson(cleaned)
  try {
    const parsed = JSON.parse(repaired)
    return { partial: parsed, complete: false }
  } catch {
    // 如果仍然失败，返回空对象
    return { partial: {}, complete: false }
  }
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

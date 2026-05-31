import { AiAgentApiKeys, DEFAULT_GEMINI_AGENT, normalizeAgentConfigs } from '@/typings/aiModelAdaptor'
import { DefaultPromptTemplate, DefaultLanguage } from '@/const'

/**--------------------------- OPTION PAGE ---------------------------*/
/** 自定义 Prompt */
export const promptTemplate = storage.defineItem<string>('local:additionalPrompt', {
  fallback: DefaultPromptTemplate,
})

/** 目标语言 */
export const targetLanguage = storage.defineItem<string>('local:targetLanguage', {
  fallback: DefaultLanguage,
})

/** apikey 设定缓存 */
export const agentsStorage = storage.defineItem<AiAgentApiKeys>('local:agents', {
  fallback: [],
})

export async function getNormalizedAgents() {
  const raw = await agentsStorage.getValue()
  const normalized = normalizeAgentConfigs(raw)
  if (normalized.length > 0) return normalized

  const seededAgents: AiAgentApiKeys = [DEFAULT_GEMINI_AGENT]
  await agentsStorage.setValue(seededAgents)
  return seededAgents
}
/** 回显样式 */
export type highlightStyleSettingsType = {
  color: {
    a: number
    b: number
    g: number
    r: number
  }
  invertColor: boolean
  offset: string
  style: string
  thickness: string
  type: string
}
export const hightlightStyle = storage.defineItem<highlightStyleSettingsType>('local:hightlightStyle', {
  fallback: {
    color: {
      a: 1,
      b: 0,
      g: 191,
      r: 255,
    },
    invertColor: false,
    offset: '4',
    style: 'wavy',
    thickness: '2',
    type: 'underline',
  },
})
export const recordPageSize = storage.defineItem<number>('local:recordPageSize', {
  fallback: 5,
})

export const githubAccessToken = storage.defineItem<string | null>('local:githubAccessToken', {
  fallback: null,
})

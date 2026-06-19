import { AiAgentApiKeys, normalizeAgentConfigs } from '@/typings/aiModelAdaptor'
import { DefaultPromptTemplate, DefaultLanguage } from '@/const'
import type { ThemePreference } from '@/lib/theme'

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
  return normalizeAgentConfigs(raw)
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
  type: 'underline' | 'background' | 'underline-background' | string
  backgroundOpacity: string
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
    backgroundOpacity: '0.18',
  },
})
export const recordPageSize = storage.defineItem<number>('local:recordPageSize', {
  fallback: 5,
})

export const aiMaxRetries = storage.defineItem<number>('local:aiMaxRetries', {
  fallback: 2,
})

export type TranslationRevealMode = 'hover' | 'always'

export const translationRevealMode = storage.defineItem<TranslationRevealMode>('local:translationRevealMode', {
  fallback: 'hover',
})

export const themePreference = storage.defineItem<ThemePreference>('local:vocabify-theme', {
  fallback: 'system',
})

export const githubAccessToken = storage.defineItem<string | null>('local:githubAccessToken', {
  fallback: null,
})

export type GithubSyncAccount = {
  login: string
  repoName: string
}

export const githubSyncAccount = storage.defineItem<GithubSyncAccount | null>('local:githubSyncAccount', {
  fallback: null,
})

export const githubLastSyncAt = storage.defineItem<string | null>('local:githubLastSyncAt', {
  fallback: null,
})

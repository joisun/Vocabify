import { AiAgentApiKeys } from '@/typings/aiModelAdaptor'
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
  fallback: [
    {
      agentName: 'XunFeiSpark',
      apiKey: 'MTrricoschHlfxWNvIJD:ZXklDofIqPdoBxkWsjTA',
    },
    {
      agentName: 'ChatAnywhere',
      apiKey: 'sk-M72D5lilVXr4dKsWwPJgs8PRzvnLQleW0UrpBKdjjm7hHWWL',
    },
  ],
})
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
/**--------------------------- SIDE PANEL ---------------------------*/
export const recordPageSize = storage.defineItem<number>('local:recordPageSize', {
  fallback: 5,
})

/** 首次程序调用打开 sidepanel 缓存的任务*/
export const firstSelection = storage.defineItem<string>('session:firstSelection', {
  fallback: '',
})
export const firstCheckRecord = storage.defineItem<string>('session:firstCheckRecord', {
  fallback: '',
})

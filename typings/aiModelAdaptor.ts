export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'

export interface AIProviderTemplate {
  id: AIProviderId
  label: string
  defaultModel: string
  staticModels: string[]
  packageName: string
}

export const AI_PROVIDER_TEMPLATES: AIProviderTemplate[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    staticModels: ['gpt-4o-mini', 'gpt-4o', 'o4-mini', 'o3', 'o3-mini'],
    packageName: '@ai-sdk/openai',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    staticModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    packageName: '@ai-sdk/anthropic',
  },
  {
    id: 'google',
    label: 'Google Generative AI',
    defaultModel: 'gemini-2.5-flash-lite',
    staticModels: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    packageName: '@ai-sdk/google',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    staticModels: ['deepseek-chat', 'deepseek-reasoner'],
    packageName: '@ai-sdk/deepseek',
  },
]

export const DEFAULT_PROVIDER_TEMPLATE = AI_PROVIDER_TEMPLATES[0]

export interface AiAgentApiKey {
  providerId: AIProviderId | `custom:${string}`
  providerLabel: string
  apiKey: string
  model: string
  baseURL?: string
}

export type AiAgentApiKeys = AiAgentApiKey[]

export function getProviderTemplate(providerId: string): AIProviderTemplate | undefined {
  return AI_PROVIDER_TEMPLATES.find((template) => template.id === providerId)
}

function isCustomProviderId(providerId: string): providerId is `custom:${string}` {
  return providerId.startsWith('custom:') && providerId.length > 'custom:'.length
}

function normalizeModernAgent(item: Partial<AiAgentApiKey>): AiAgentApiKey | null {
  const providerId = item.providerId?.trim()
  const apiKey = item.apiKey?.trim()
  if (!providerId || !apiKey) return null

  const template = getProviderTemplate(providerId)
  const isCustom = isCustomProviderId(providerId)
  if (!template && !isCustom) return null

  const providerLabel = item.providerLabel?.trim() || template?.label || providerId.replace(/^custom:/, '')
  const model = item.model?.trim() || template?.defaultModel
  if (!model) return null

  const baseURL = isCustom ? item.baseURL?.trim() : undefined
  if (isCustom && !baseURL) return null

  return {
    providerId: template ? template.id : providerId as `custom:${string}`,
    providerLabel,
    apiKey,
    model,
    ...(baseURL ? { baseURL } : {}),
  }
}

export function normalizeAgentConfigs(raw: unknown): AiAgentApiKeys {
  if (!Array.isArray(raw)) return []

  const normalized: AiAgentApiKeys = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const modern = normalizeModernAgent(entry as Partial<AiAgentApiKey>)
    if (modern) normalized.push(modern)
  }

  return normalized
}

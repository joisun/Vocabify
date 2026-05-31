export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'deepseek'
  | 'fireworks'
  | 'togetherai'
  | 'cerebras'
  | 'perplexity'
  | 'deepinfra'

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
    id: 'xai',
    label: 'xAI Grok',
    defaultModel: 'grok-3-mini',
    staticModels: ['grok-3-mini', 'grok-3', 'grok-2-vision-1212'],
    packageName: '@ai-sdk/xai',
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.1-8b-instant',
    staticModels: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    packageName: '@ai-sdk/groq',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    defaultModel: 'mistral-small-latest',
    staticModels: ['mistral-small-latest', 'mistral-large-latest', 'codestral-latest'],
    packageName: '@ai-sdk/mistral',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    defaultModel: 'command-r-plus',
    staticModels: ['command-r-plus', 'command-r', 'command-a-03-2025'],
    packageName: '@ai-sdk/cohere',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    staticModels: ['deepseek-chat', 'deepseek-reasoner'],
    packageName: '@ai-sdk/deepseek',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    staticModels: ['accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/llama-v3p3-70b-instruct'],
    packageName: '@ai-sdk/fireworks',
  },
  {
    id: 'togetherai',
    label: 'Together.ai',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    staticModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
    packageName: '@ai-sdk/togetherai',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    defaultModel: 'llama3.1-8b',
    staticModels: ['llama3.1-8b', 'llama3.3-70b'],
    packageName: '@ai-sdk/cerebras',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    defaultModel: 'sonar',
    staticModels: ['sonar', 'sonar-pro', 'sonar-reasoning'],
    packageName: '@ai-sdk/perplexity',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    staticModels: ['meta-llama/Meta-Llama-3.1-8B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'],
    packageName: '@ai-sdk/deepinfra',
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

export const DEFAULT_GEMINI_AGENT: AiAgentApiKey = {
  providerId: 'google',
  providerLabel: 'Google Generative AI',
  apiKey: 'AIzaSyDyc6XAitUdMVSfYsqZEQAdMUeOAFgf5Hk',
  model: 'gemini-2.5-flash-lite',
}

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

export type AIProviderCategory = 'first-party' | 'openai-compatible' | 'community'
export type AIProviderProtocol = 'gemini-native' | 'openai-compatible' | 'anthropic'

export interface AIProviderTemplate {
  id: string
  label: string
  category: AIProviderCategory
  protocol: AIProviderProtocol
  defaultModel: string
  staticModels: string[]
  baseURL?: string
  packageName?: string
  builtin?: boolean
}

export const AI_PROVIDER_TEMPLATES: AIProviderTemplate[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1',
    staticModels: ['gpt-4o-mini', 'gpt-4o', 'o4-mini', 'o3', 'o3-mini'],
    packageName: '@ai-sdk/openai',
    builtin: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    category: 'first-party',
    protocol: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    baseURL: 'https://api.anthropic.com/v1',
    staticModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    packageName: '@ai-sdk/anthropic',
    builtin: true,
  },
  {
    id: 'google',
    label: 'Google Generative AI',
    category: 'first-party',
    protocol: 'gemini-native',
    defaultModel: 'gemini-2.5-flash-lite',
    baseURL: 'https://generativelanguage.googleapis.com',
    staticModels: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    packageName: '@ai-sdk/google',
    builtin: true,
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'grok-3-mini',
    baseURL: 'https://api.x.ai/v1',
    staticModels: ['grok-3-mini', 'grok-3', 'grok-2-vision-1212'],
    packageName: '@ai-sdk/xai',
    builtin: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'llama-3.1-8b-instant',
    baseURL: 'https://api.groq.com/openai/v1',
    staticModels: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    packageName: '@ai-sdk/groq',
    builtin: true,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'mistral-small-latest',
    baseURL: 'https://api.mistral.ai/v1',
    staticModels: ['mistral-small-latest', 'mistral-large-latest', 'codestral-latest'],
    packageName: '@ai-sdk/mistral',
    builtin: true,
  },
  {
    id: 'cohere',
    label: 'Cohere',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'command-r-plus',
    baseURL: 'https://api.cohere.com/compatibility/v1',
    staticModels: ['command-r-plus', 'command-r', 'command-a-03-2025'],
    packageName: '@ai-sdk/cohere',
    builtin: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    staticModels: ['deepseek-chat', 'deepseek-reasoner'],
    packageName: '@ai-sdk/deepseek',
    builtin: true,
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    staticModels: ['accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/llama-v3p3-70b-instruct'],
    packageName: '@ai-sdk/fireworks',
    builtin: true,
  },
  {
    id: 'togetherai',
    label: 'Together.ai',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseURL: 'https://api.together.xyz/v1',
    staticModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
    packageName: '@ai-sdk/togetherai',
    builtin: true,
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'llama3.1-8b',
    baseURL: 'https://api.cerebras.ai/v1',
    staticModels: ['llama3.1-8b', 'llama3.3-70b'],
    packageName: '@ai-sdk/cerebras',
    builtin: true,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'sonar',
    baseURL: 'https://api.perplexity.ai',
    staticModels: ['sonar', 'sonar-pro', 'sonar-reasoning'],
    packageName: '@ai-sdk/perplexity',
    builtin: true,
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    category: 'first-party',
    protocol: 'openai-compatible',
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    staticModels: ['meta-llama/Meta-Llama-3.1-8B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'],
    packageName: '@ai-sdk/deepinfra',
    builtin: true,
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    category: 'openai-compatible',
    protocol: 'openai-compatible',
    defaultModel: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1',
    staticModels: ['gpt-4o-mini'],
    packageName: '@ai-sdk/openai-compatible',
    builtin: true,
  },
  {
    id: 'ollama',
    label: 'Ollama',
    category: 'community',
    protocol: 'openai-compatible',
    defaultModel: 'llama3.1',
    baseURL: 'http://localhost:11434/v1',
    staticModels: ['llama3.1', 'mistral', 'qwen2.5'],
    packageName: 'ollama-ai-provider',
    builtin: true,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    category: 'community',
    protocol: 'openai-compatible',
    defaultModel: 'local-model',
    baseURL: 'http://localhost:1234/v1',
    staticModels: ['local-model'],
    builtin: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    category: 'community',
    protocol: 'openai-compatible',
    defaultModel: 'openai/gpt-4o-mini',
    baseURL: 'https://openrouter.ai/api/v1',
    staticModels: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5'],
    builtin: true,
  },
]

export const DEFAULT_PROVIDER_TEMPLATE = AI_PROVIDER_TEMPLATES[0]

export interface AiAgentApiKey {
  providerId: string
  providerLabel: string
  category: AIProviderCategory
  protocol: AIProviderProtocol
  apiKey: string
  model: string
  baseURL?: string
}

export type AiAgentApiKeys = AiAgentApiKey[]

export const DEFAULT_GEMINI_AGENT: AiAgentApiKey = {
  providerId: 'google',
  providerLabel: 'Google Generative AI',
  category: 'first-party',
  protocol: 'gemini-native',
  apiKey: 'AIzaSyDyc6XAitUdMVSfYsqZEQAdMUeOAFgf5Hk',
  model: 'gemini-2.5-flash-lite',
  baseURL: 'https://generativelanguage.googleapis.com',
}

export function isProviderCategory(value: unknown): value is AIProviderCategory {
  return value === 'first-party' || value === 'openai-compatible' || value === 'community'
}

export function isProviderProtocol(value: unknown): value is AIProviderProtocol {
  return value === 'gemini-native' || value === 'openai-compatible' || value === 'anthropic'
}

export function getProviderTemplate(providerId: string): AIProviderTemplate | undefined {
  return AI_PROVIDER_TEMPLATES.find((template) => template.id === providerId)
}

function normalizeModernAgent(item: Partial<AiAgentApiKey>): AiAgentApiKey | null {
  const providerId = item.providerId?.trim()
  const apiKey = item.apiKey?.trim()
  if (!providerId || !apiKey) return null

  const template = getProviderTemplate(providerId)
  const protocol = isProviderProtocol(item.protocol) ? item.protocol : template?.protocol
  if (!protocol) return null

  const category = isProviderCategory(item.category) ? item.category : template?.category
  if (!category) return null

  const providerLabel = item.providerLabel?.trim() || template?.label || providerId
  const model = item.model?.trim() || template?.defaultModel
  if (!model) return null

  const baseURL = item.baseURL?.trim() || template?.baseURL

  return {
    providerId,
    providerLabel,
    category,
    protocol,
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

import { streamText, type LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { aiMaxRetries, promptTemplate, targetLanguage, getNormalizedAgents } from '@/utils/storage'
import { AiAgentApiKey } from '@/typings/aiModelAdaptor'
import {
  Language_Placeholder,
  Selection_Placeholder,
  SourceContext_Placeholder,
} from '@/const'
import { vocabResponseSchema, type VocabResponse } from './aiSchema'
import { parsePartialJson } from './partialJson'

export interface AIStreamOptions {
  text: string
  sourceContext?: string
  abortSignal?: AbortSignal
  onChunk?: (chunk: string) => void
  onPartial?: (partial: Partial<VocabResponse>) => void
  onComplete?: (final: VocabResponse) => void
  onError?: (error: Error) => void
  onRetry?: (attempt: number, maxRetries: number, error: Error) => void
}

export class AIService {
  private async getPrompt(text: string, sourceContext?: string): Promise<string> {
    const template = await promptTemplate.getValue()
    const language = await targetLanguage.getValue()
    const resolvedTemplate = template
      .split(Selection_Placeholder).join(text)
      .split(Language_Placeholder).join(language)
      .split(SourceContext_Placeholder).join(sourceContext || 'N/A')

    return resolvedTemplate
  }

  private createModel(agent: AiAgentApiKey): LanguageModel {
    switch (agent.providerId) {
      case 'openai':
        return createOpenAI({ apiKey: agent.apiKey })(agent.model)
      case 'anthropic':
        return createAnthropic({ apiKey: agent.apiKey })(agent.model)
      case 'google':
        return createGoogleGenerativeAI({ apiKey: agent.apiKey })(agent.model)
      case 'deepseek':
        return createDeepSeek({ apiKey: agent.apiKey })(agent.model)
      default:
        if (agent.providerId.startsWith('custom:')) {
          if (!agent.baseURL) throw new Error(`${agent.providerLabel} requires a baseURL`)
          return createOpenAICompatible({
            name: agent.providerId,
            baseURL: agent.baseURL,
            apiKey: agent.apiKey,
          })(agent.model)
        }
        throw new Error(`Unsupported AI provider: ${agent.providerId}`)
    }
  }

  private async streamWithVercelSdk(agent: AiAgentApiKey, prompt: string, options: AIStreamOptions) {
    const { fullStream } = await streamText({
      model: this.createModel(agent),
      prompt,
      maxRetries: 0,
      abortSignal: options.abortSignal,
      timeout: {
        totalMs: 60_000,
        chunkMs: 30_000,
      },
    })

    let buffer = ''

    for await (const part of fullStream) {
      if (part.type === 'reasoning-delta') {
        // Reasoning is not user-visible structured content.
        continue
      } else if (part.type === 'error') {
        throw normalizeAiError(part.error, agent.providerLabel)
      } else if (part.type === 'text-delta') {
        buffer += part.text
        options.onChunk?.(part.text)

        const { partial, complete } = parsePartialJson(buffer)
        options.onPartial?.(partial)

        if (complete) break
      }
    }

    const { partial } = parsePartialJson(buffer)
    const parseResult = vocabResponseSchema.safeParse(partial)

    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]
      const path = firstIssue?.path.join('.') || 'root'
      throw new Error(
        `${agent.providerLabel} returned invalid JSON: ${path} - ${firstIssue?.message || 'schema mismatch'}`,
      )
    }

    options.onComplete?.(parseResult.data)
  }

  async streamExplanation(options: AIStreamOptions): Promise<void> {
    const agents = await getNormalizedAgents()
    const prompt = await this.getPrompt(options.text, options.sourceContext)
    const maxRetries = normalizeRetryCount(await aiMaxRetries.getValue())

    if (!agents.length) {
      options.onError?.(new Error('No AI providers configured'))
      return
    }

    const agent = agents[0]
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.streamWithVercelSdk(agent, prompt, options)
        return
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        lastError = normalized
        console.error(`Failed with ${agent.providerLabel} (${agent.model}) attempt ${attempt + 1}/${maxRetries + 1}:`, normalized)
        if (options.abortSignal?.aborted) break
        if (attempt < maxRetries) {
          options.onRetry?.(attempt + 1, maxRetries, normalized)
          await delay(getRetryDelayMs(attempt), options.abortSignal)
          continue
        }
      }
    }

    const finalError = lastError || new Error('The AI provider did not return a usable response.')
    if (maxRetries > 0) {
      options.onError?.(new Error(`${finalError.message} (retried ${maxRetries} ${maxRetries === 1 ? 'time' : 'times'})`))
    } else {
      options.onError?.(finalError)
    }
  }
}

export const aiService = new AIService()

function normalizeAiError(error: unknown, providerLabel: string) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const status = record.statusCode || record.status || record.code
    const message = record.message || record.error || JSON.stringify(record)
    return new Error(`${providerLabel} request failed${status ? ` (${status})` : ''}: ${String(message)}`)
  }
  return new Error(`${providerLabel} request failed: ${String(error || 'unknown error')}`)
}

function normalizeRetryCount(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 2
  return Math.max(0, Math.min(5, Math.round(parsed)))
}

function getRetryDelayMs(attempt: number) {
  return Math.min(1_000 * 2 ** attempt, 4_000)
}

function delay(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

import { streamText, type LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createCerebras } from '@ai-sdk/cerebras'
import { createCohere } from '@ai-sdk/cohere'
import { createDeepInfra } from '@ai-sdk/deepinfra'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createPerplexity } from '@ai-sdk/perplexity'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createXai } from '@ai-sdk/xai'
import { promptTemplate, targetLanguage, getNormalizedAgents } from '@/utils/storage'
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
      case 'xai':
        return createXai({ apiKey: agent.apiKey })(agent.model)
      case 'groq':
        return createGroq({ apiKey: agent.apiKey })(agent.model)
      case 'mistral':
        return createMistral({ apiKey: agent.apiKey })(agent.model)
      case 'cohere':
        return createCohere({ apiKey: agent.apiKey })(agent.model)
      case 'deepseek':
        return createDeepSeek({ apiKey: agent.apiKey })(agent.model)
      case 'fireworks':
        return createFireworks({ apiKey: agent.apiKey })(agent.model)
      case 'togetherai':
        return createTogetherAI({ apiKey: agent.apiKey })(agent.model)
      case 'cerebras':
        return createCerebras({ apiKey: agent.apiKey })(agent.model)
      case 'perplexity':
        return createPerplexity({ apiKey: agent.apiKey })(agent.model)
      case 'deepinfra':
        return createDeepInfra({ apiKey: agent.apiKey })(agent.model)
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
        // 讯飞的 reasoning_content 会被映射为这个类型
        options.onChunk?.(part.text)
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

    if (!agents.length) {
      options.onError?.(new Error('No AI providers configured'))
      return
    }

    let lastError: Error | null = null

    for (const agent of agents) {
      try {
        await this.streamWithVercelSdk(agent, prompt, options)
        return
      } catch (error) {
        console.error(`Failed with ${agent.providerLabel} (${agent.model}):`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    options.onError?.(lastError || new Error('All AI providers failed'))
  }
}

export const aiService = new AIService()

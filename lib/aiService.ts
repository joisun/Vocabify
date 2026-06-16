import { streamText, type LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
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

    const agent = agents[0]
    try {
      await this.streamWithVercelSdk(agent, prompt, options)
    } catch (error) {
      console.error(`Failed with ${agent.providerLabel} (${agent.model}):`, error)
      options.onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export const aiService = new AIService()

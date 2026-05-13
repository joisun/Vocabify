import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { agentsStorage, promptTemplate, targetLanguage } from '@/utils/storage'
import { AgentsType } from '@/typings/aiModelAdaptor'

export interface AIStreamOptions {
  text: string
  onChunk?: (chunk: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: Error) => void
}

export class AIService {
  private async getPrompt(text: string): Promise<string> {
    const template = await promptTemplate.getValue()
    const language = await targetLanguage.getValue()

    return `${template}\n\nTarget Language: ${language}\n\nText to explain: ${text}`
  }

  private getModelProvider(agentName: AgentsType, apiKey: string) {
    // OpenAI models
    if (agentName.startsWith('OpenAI')) {
      const openai = createOpenAI({ apiKey })
      return openai(this.mapToOpenAIModel(agentName))
    }

    // Anthropic models
    if (agentName.startsWith('Anthropic')) {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(this.mapToAnthropicModel(agentName))
    }

    // ChatAnywhere (OpenAI compatible)
    if (agentName.startsWith('ChatAnywhere')) {
      const chatAnywhere = createOpenAI({
        apiKey,
        baseURL: 'https://api.chatanywhere.tech/v1'
      })
      return chatAnywhere(this.mapToChatAnywhereModel(agentName))
    }

    // Kimi Moonshot (OpenAI compatible)
    if (agentName.startsWith('Kimi')) {
      const kimi = createOpenAI({
        apiKey,
        baseURL: 'https://api.moonshot.cn/v1'
      })
      return kimi(this.mapToKimiModel(agentName))
    }

    throw new Error(`Unsupported agent: ${agentName}`)
  }

  private mapToOpenAIModel(agentName: AgentsType): string {
    const mapping: Record<string, string> = {
      [AgentsType.OpenAI_GPT4o]: 'gpt-4o',
      [AgentsType.OpenAI_GPT4o_Mini]: 'gpt-4o-mini',
      [AgentsType.OpenAI_GPT4_Turbo]: 'gpt-4-turbo',
      [AgentsType.OpenAI_GPT4]: 'gpt-4',
      [AgentsType.OpenAI_GPT4_32K]: 'gpt-4-32k',
      [AgentsType.OpenAI_GPT3_5_Turbo]: 'gpt-3.5-turbo',
      [AgentsType.OpenAI_GPT3_5_Turbo_Instruct]: 'gpt-3.5-turbo-instruct',
      [AgentsType.OpenAI_O1]: 'o1',
      [AgentsType.OpenAI_O1_Mini]: 'o1-mini',
      [AgentsType.OpenAI_O3_Mini]: 'o3-mini',
    }
    return mapping[agentName] || 'gpt-4o-mini'
  }

  private mapToAnthropicModel(agentName: AgentsType): string {
    // Add Anthropic model mapping if needed
    return 'claude-3-5-sonnet-20241022'
  }

  private mapToChatAnywhereModel(agentName: AgentsType): string {
    const mapping: Record<string, string> = {
      [AgentsType.ChatAnywhere_GPT4oMini]: 'gpt-4o-mini',
      [AgentsType.ChatAnywhere_GPT35Turbo]: 'gpt-3.5-turbo',
      [AgentsType.ChatAnywhere_GPT4o]: 'gpt-4o',
      [AgentsType.ChatAnywhere_GPT4]: 'gpt-4',
    }
    return mapping[agentName] || 'gpt-3.5-turbo'
  }

  private mapToKimiModel(agentName: AgentsType): string {
    const mapping: Record<string, string> = {
      [AgentsType.Kimi_Moonshot_8K]: 'moonshot-v1-8k',
      [AgentsType.Kimi_Moonshot_32K]: 'moonshot-v1-32k',
      [AgentsType.Kimi_Moonshot_128K]: 'moonshot-v1-128k',
    }
    return mapping[agentName] || 'moonshot-v1-8k'
  }

  async streamExplanation(options: AIStreamOptions): Promise<void> {
    const agents = await agentsStorage.getValue()
    const prompt = await this.getPrompt(options.text)

    let lastError: Error | null = null

    // Try each agent in order (fallback logic)
    for (const agent of agents) {
      try {
        // Skip XunFeiSpark (WebSocket not supported by Vercel AI SDK)
        if (agent.agentName.startsWith('XunFeiSpark')) {
          continue
        }

        const model = this.getModelProvider(agent.agentName, agent.apiKey)

        const { textStream } = await streamText({
          model,
          prompt,
        })

        let fullText = ''

        for await (const chunk of textStream) {
          fullText += chunk
          options.onChunk?.(chunk)
        }

        options.onComplete?.(fullText)
        return // Success, exit

      } catch (error) {
        console.error(`Failed with ${agent.agentName}:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        // Continue to next agent
      }
    }

    // All agents failed
    options.onError?.(lastError || new Error('All AI agents failed'))
  }
}

export const aiService = new AIService()

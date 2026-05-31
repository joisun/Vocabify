import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { promptTemplate, targetLanguage, getNormalizedAgents } from '@/utils/storage'
import { AiAgentApiKey } from '@/typings/aiModelAdaptor'
import { Language_Placeholder, Selection_Placeholder } from '@/const'

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
    const resolvedTemplate = template
      .split(Selection_Placeholder).join(text)
      .split(Language_Placeholder).join(language)

    return `${resolvedTemplate}\n\nTarget Language: ${language}\n\nText to explain: ${text}`
  }

  private async streamWithGemini(
    agent: AiAgentApiKey,
    prompt: string,
    options: AIStreamOptions,
  ): Promise<void> {
    const baseURL = agent.baseURL?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com'
    const response = await fetch(
      `${baseURL}/v1beta/models/${agent.model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'x-goog-api-key': agent.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            maxOutputTokens: 900,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`Gemini request failed (${response.status}): ${errorText || response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Gemini streaming response is not readable')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    const consumeEvent = (event: string) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim()

      if (!data || data === '[DONE]') return

      const parsed = JSON.parse(data)
      const promptFeedback = parsed?.promptFeedback
      if (promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked the prompt: ${promptFeedback.blockReason}`)
      }

      const chunk = extractGeminiText(parsed)
      if (!chunk) return

      fullText += chunk
      options.onChunk?.(chunk)
    }

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })

      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() || ''

      for (const event of events) {
        consumeEvent(event)
      }

      if (done) break
    }

    if (buffer.trim()) {
      consumeEvent(buffer)
    }

    if (!fullText.trim()) {
      throw new Error('Gemini returned an empty explanation')
    }

    options.onComplete?.(fullText)
  }

  private async streamWithVercelSdk(agent: AiAgentApiKey, prompt: string, options: AIStreamOptions) {
    let model: Parameters<typeof streamText>[0]['model']

    if (agent.protocol === 'anthropic') {
      const anthropic = createAnthropic({
        apiKey: agent.apiKey,
        ...(agent.baseURL ? { baseURL: agent.baseURL } : {}),
      })
      model = anthropic(agent.model)
    } else if (agent.protocol === 'openai-compatible') {
      const openaiCompatible = createOpenAICompatible({
        name: agent.providerId,
        baseURL: agent.baseURL || 'https://api.openai.com/v1',
        apiKey: agent.apiKey,
      })
      model = openaiCompatible(agent.model)
    } else {
      throw new Error(`Unsupported protocol for Vercel SDK: ${agent.protocol}`)
    }

    const { textStream } = await streamText({ model, prompt })
    let fullText = ''
    for await (const chunk of textStream) {
      fullText += chunk
      options.onChunk?.(chunk)
    }

    if (!fullText.trim()) {
      throw new Error(`${agent.providerLabel} returned an empty explanation`)
    }

    options.onComplete?.(fullText)
  }

  async streamExplanation(options: AIStreamOptions): Promise<void> {
    const agents = await getNormalizedAgents()
    const prompt = await this.getPrompt(options.text)

    if (!agents.length) {
      options.onError?.(new Error('No AI providers configured'))
      return
    }

    let lastError: Error | null = null

    for (const agent of agents) {
      try {
        if (agent.protocol === 'gemini-native') {
          await this.streamWithGemini(agent, prompt, options)
          return
        }

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

function extractGeminiText(response: any): string {
  return response?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('') || ''
}

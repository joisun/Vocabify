import { AgentsType } from '@/typings/aiModelAdaptor'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatOpenAI } from '@langchain/openai'

export interface AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel
}

const commonConfig = {
  temperature: 0.7,
  streaming: false,
  maxRetries: 1,
  timeout: 8000,
}
class ChatAnywhereAdapter implements AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-3.5-turbo',
      ...commonConfig,
      configuration: {
        baseURL: 'https://api.chatanywhere.tech/v1',
      },
    })
  }
}

class XunFeiSparkAdapter implements AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'generalv3',
      ...commonConfig,
      configuration: {
        baseURL: 'https://spark-api-open.xf-yun.com/v1',
      },
    })
  }
}

class KimiAdapter implements AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'moonshot-v1-8k',
      ...commonConfig,
      configuration: {
        baseURL: 'https://api.moonshot.cn/v1/',
      },
    })
  }
}

class OpenAIturboAdapter implements AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-3.5-turbo',
      ...commonConfig,
      configuration: {
        baseURL: 'https://api.openai.com/v1',
      },
    })
  }
}

class GPT4oAdapter implements AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4.0',
      ...commonConfig,
      configuration: {
        baseURL: 'https://api.openai.com/v1',
      },
    })
  }
}

class GPT4oMiniAdapter implements AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4.0-mini',
      ...commonConfig,
      configuration: {
        baseURL: 'https://api.openai.com/v1',
      },
    })
  }
}

// 适配器工厂
export class AIModelAdapterFactory {
  private static adapters: Map<AgentsType, AIModelAdapter> = new Map([
    [AgentsType.ChatAnywhere, new ChatAnywhereAdapter()],
    [AgentsType.XunFeiSpark, new XunFeiSparkAdapter()],
    [AgentsType.Kimi, new KimiAdapter()],
    [AgentsType.OpenAIturbo, new OpenAIturboAdapter()],
    [AgentsType.GPT4o, new GPT4oAdapter()], // 新增的 GPT-4.0 适配器
    [AgentsType.GPT4oMini, new GPT4oMiniAdapter()], // 新增的 GPT-4.0-mini 适配器
  ])

  static getAdapter(type: AgentsType): AIModelAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(`No adapter found for model type: ${type}`)
    }
    return adapter
  }

  // 用于动态注册新的适配器
  static registerAdapter(type: AgentsType, adapter: AIModelAdapter) {
    this.adapters.set(type, adapter)
  }
}

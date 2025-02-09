import { AIModelAdapter } from './index'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatOpenAI } from '@langchain/openai'
import BaseLanguageModelOptions from './BaseLanguageModelOptions'

const commonConfig = {
  ...BaseLanguageModelOptions,
  configuration: {
    baseURL: 'https://api.chatanywhere.tech/v1',
  },
}

class BaseChatAnywhereAdapter implements AIModelAdapter {
  private modelName: string

  constructor(modelName: string) {
    this.modelName = modelName
  }

  createModel(apiKey: string): BaseLanguageModel {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: this.modelName,
      ...commonConfig,
    })
  }
}

const ChatAnywhereGPT4oMiniAdapter = new BaseChatAnywhereAdapter('gpt-4o-mini')
const ChatAnywhereGPT35TurboAdapter = new BaseChatAnywhereAdapter('gpt-3.5-turbo')
const ChatAnywhereGPT4oAdapter = new BaseChatAnywhereAdapter('gpt-4o')
const ChatAnywhereGPT4Adapter = new BaseChatAnywhereAdapter('gpt-4')

export {
  ChatAnywhereGPT4oMiniAdapter,
  ChatAnywhereGPT35TurboAdapter,
  ChatAnywhereGPT4oAdapter,
  ChatAnywhereGPT4Adapter,
}

import { AIModelAdapter } from './index'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatOpenAI } from '@langchain/openai'
import BaseLanguageModelOptions from './BaseLanguageModelOptions'

const commonConfig = {
  ...BaseLanguageModelOptions,
  configuration: {
    baseURL: 'https://api.openai.com/v1',
  },
}

class BaseOpenAIAdapter implements AIModelAdapter {
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

const OpenAIGPT4oAdapter = new BaseOpenAIAdapter('gpt-4.0')
const OpenAIGPT4oMiniAdapter = new BaseOpenAIAdapter('gpt-4.0-mini')
const OpenAIGPT4TurboAdapter = new BaseOpenAIAdapter('gpt-4-turbo')
const OpenAIGPT4Adapter = new BaseOpenAIAdapter('gpt-4')
const OpenAIGPT432KAdapter = new BaseOpenAIAdapter('gpt-4-32k')
const OpenAIGPT35TurboAdapter = new BaseOpenAIAdapter('gpt-3.5-turbo')
const OpenAIGPT35TurboInstructAdapter = new BaseOpenAIAdapter('gpt-3.5-turbo-instruct')
const OpenAIO1Adapter = new BaseOpenAIAdapter('o1')
const OpenAIO1MiniAdapter = new BaseOpenAIAdapter('o1-mini')
const OpenAIO3MiniAdapter = new BaseOpenAIAdapter('o3-mini')

export {
  OpenAIGPT4oAdapter,
  OpenAIGPT4oMiniAdapter,
  OpenAIGPT4TurboAdapter,
  OpenAIGPT4Adapter,
  OpenAIGPT432KAdapter,
  OpenAIGPT35TurboAdapter,
  OpenAIGPT35TurboInstructAdapter,
  OpenAIO1Adapter,
  OpenAIO1MiniAdapter,
  OpenAIO3MiniAdapter,
}

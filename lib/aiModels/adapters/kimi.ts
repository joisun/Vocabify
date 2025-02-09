// https://platform.moonshot.cn/docs/api/chat#%E5%85%AC%E5%BC%80%E7%9A%84%E6%9C%8D%E5%8A%A1%E5%9C%B0%E5%9D%80
import { AIModelAdapter } from './index'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatOpenAI } from '@langchain/openai'
import BaseLanguageModelOptions from './BaseLanguageModelOptions'
const commonConfig = {
  ...BaseLanguageModelOptions,
  configuration: {
    baseURL: 'https://api.moonshot.cn/v1',
  },
}

class BaseKimiAdapter implements AIModelAdapter {
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

const KimiMoonshot8KAdapter = new BaseKimiAdapter('moonshot-v1-8k')
const KimiMoonshot32KAdapter = new BaseKimiAdapter('moonshot-v1-32k')
const KimiMoonshot128KAdapter = new BaseKimiAdapter('moonshot-v1-128k')

export { KimiMoonshot8KAdapter, KimiMoonshot32KAdapter, KimiMoonshot128KAdapter }

// https://console.xfyun.cn/services/bm35
import { AIModelAdapter } from './index'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatOpenAI } from '@langchain/openai'
import BaseLanguageModelOptions from './BaseLanguageModelOptions'

const commonConfig = {
  ...BaseLanguageModelOptions,
  configuration: {
    baseURL: 'https://spark-api-open.xf-yun.com/v1',
  },
}

class BaseXunFeiAdapter implements AIModelAdapter {
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

const XunFeiSparkLiteAdapter = new BaseXunFeiAdapter('lite')
const XunFeiSparkProAdapter = new BaseXunFeiAdapter('generalv3')
const XunFeiSparkPro128KAdapter = new BaseXunFeiAdapter('pro-128k')
const XunFeiSparkMaxAdapter = new BaseXunFeiAdapter('generalv3.5')
const XunFeiSparkMax32KAdapter = new BaseXunFeiAdapter('max-32k')
const XunFeiSpark4UltraAdapter = new BaseXunFeiAdapter('4.0Ultra')

export { XunFeiSparkLiteAdapter, XunFeiSparkProAdapter, XunFeiSparkPro128KAdapter, XunFeiSparkMaxAdapter, XunFeiSparkMax32KAdapter, XunFeiSpark4UltraAdapter }

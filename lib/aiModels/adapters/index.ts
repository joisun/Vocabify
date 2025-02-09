import { AgentsType } from '@/typings/aiModelAdaptor'
import { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatOpenAI } from '@langchain/openai'
import {
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
} from './openai'
import {
  XunFeiSparkLiteAdapter,
  XunFeiSparkProAdapter,
  XunFeiSparkPro128KAdapter,
  XunFeiSparkMaxAdapter,
  XunFeiSparkMax32KAdapter,
  XunFeiSpark4UltraAdapter,
} from './xunfei'
import { KimiMoonshot8KAdapter, KimiMoonshot32KAdapter, KimiMoonshot128KAdapter } from './kimi'
import { ChatAnywhereGPT4oMiniAdapter, ChatAnywhereGPT35TurboAdapter, ChatAnywhereGPT4oAdapter, ChatAnywhereGPT4Adapter } from './chatanywhere'

export interface AIModelAdapter {
  createModel(apiKey: string): BaseLanguageModel
}

// 适配器工厂
export class AIModelAdapterFactory {
  private static adapters: Map<AgentsType, AIModelAdapter> = new Map<AgentsType, AIModelAdapter>([
    [AgentsType.ChatAnywhere_GPT4oMini, ChatAnywhereGPT4oMiniAdapter],
    [AgentsType.ChatAnywhere_GPT35Turbo, ChatAnywhereGPT35TurboAdapter],
    [AgentsType.ChatAnywhere_GPT4o, ChatAnywhereGPT4oAdapter],
    [AgentsType.ChatAnywhere_GPT4, ChatAnywhereGPT4Adapter],
    [AgentsType.XunFeiSpark, XunFeiSparkProAdapter],
    [AgentsType.XunFeiSpark_Lite, XunFeiSparkLiteAdapter],
    [AgentsType.XunFeiSpark_Pro, XunFeiSparkProAdapter],
    [AgentsType.XunFeiSpark_Pro_128K, XunFeiSparkPro128KAdapter],
    [AgentsType.XunFeiSpark_Max, XunFeiSparkMaxAdapter],
    [AgentsType.XunFeiSpark_Max_32K, XunFeiSparkMax32KAdapter],
    [AgentsType.XunFeiSpark_4Ultra, XunFeiSpark4UltraAdapter],
    [AgentsType.Kimi_Moonshot_8K, KimiMoonshot8KAdapter],
    [AgentsType.Kimi_Moonshot_32K, KimiMoonshot32KAdapter],
    [AgentsType.Kimi_Moonshot_128K, KimiMoonshot128KAdapter],
    [AgentsType.OpenAI_GPT4o, OpenAIGPT4oAdapter],
    [AgentsType.OpenAI_GPT4o_Mini, OpenAIGPT4oMiniAdapter],
    [AgentsType.OpenAI_GPT4_Turbo, OpenAIGPT4TurboAdapter],
    [AgentsType.OpenAI_GPT4, OpenAIGPT4Adapter],
    [AgentsType.OpenAI_GPT4_32K, OpenAIGPT432KAdapter],
    [AgentsType.OpenAI_GPT3_5_Turbo, OpenAIGPT35TurboAdapter],
    [AgentsType.OpenAI_GPT3_5_Turbo_Instruct, OpenAIGPT35TurboInstructAdapter],
    [AgentsType.OpenAI_O1, OpenAIO1Adapter],
    [AgentsType.OpenAI_O1_Mini, OpenAIO1MiniAdapter],
    [AgentsType.OpenAI_O3_Mini, OpenAIO3MiniAdapter],
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

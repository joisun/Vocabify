import { AgentsType } from '@/typings/aiModelAdaptor';
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { ChatOpenAI } from "@langchain/openai";

export interface AIModelAdapter {
    createModel(apiKey: string): BaseLanguageModel;
}

class ChatAnywhereAdapter implements AIModelAdapter {
    createModel(apiKey: string): BaseLanguageModel {
        return new ChatOpenAI({
            openAIApiKey: apiKey,
            modelName: "gpt-3.5-turbo",
            temperature: 0.7,
            streaming: false,
            configuration: {
                baseURL: "https://api.chatanywhere.tech/v1"
            }
        });
    }
}

class XunFeiSparkAdapter implements AIModelAdapter {
    createModel(apiKey: string): BaseLanguageModel {
        // 这里需要实现讯飞的具体适配逻辑
        return new ChatOpenAI({
            openAIApiKey: apiKey,
            modelName: "spark",
            temperature: 0.7,
            streaming: false,
            configuration: {
                baseURL: "https://spark-api.xf-yun.com/v1"
            }
        });
    }
}

class KimiAdapter implements AIModelAdapter {
    createModel(apiKey: string): BaseLanguageModel {
        return new ChatOpenAI({
            openAIApiKey: apiKey,
            modelName: "kimi",
            temperature: 0.7,
            streaming: false,
            configuration: {
                baseURL: "https://api.moonshot.cn/v1"
            }
        });
    }
}

// 适配器工厂
export class AIModelAdapterFactory {
    private static adapters: Map<AgentsType, AIModelAdapter> = new Map([
        [AgentsType.ChatAnywhere, new ChatAnywhereAdapter()],
        [AgentsType.XunFeiSpark, new XunFeiSparkAdapter()],
        [AgentsType.Kimi, new KimiAdapter()],
    ]);

    static getAdapter(type: AgentsType): AIModelAdapter {
        const adapter = this.adapters.get(type);
        if (!adapter) {
            throw new Error(`No adapter found for model type: ${type}`);
        }
        return adapter;
    }

    // 用于动态注册新的适配器
    static registerAdapter(type: AgentsType, adapter: AIModelAdapter) {
        this.adapters.set(type, adapter);
    }
}
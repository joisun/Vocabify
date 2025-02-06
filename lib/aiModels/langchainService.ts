import { AgentsType } from '@/typings/aiModelAdaptor';
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { AIModelAdapterFactory } from './adapters';
import { targetLanguage, promptTemplate } from "@/utils/storage";

export class LangchainService {
  private models: Map<AgentsType, BaseLanguageModel>;

  constructor() {
    this.models = new Map();
  }

  async initializeModel(type: AgentsType, apiKey: string) {
    try {
      const adapter = AIModelAdapterFactory.getAdapter(type);
      const model = adapter.createModel(apiKey);
      this.models.set(type, model);
    } catch (error) {
      console.error(`Failed to initialize model ${type}:`, error);
      throw error;
    }
  }

  async explain(type: AgentsType, selection: string): Promise<string> {
    const [language, template] = await Promise.all([
      targetLanguage.getValue(),
      promptTemplate.getValue()
    ]);

    // 每次请求创建新的 PromptTemplate
    const _promptTemplate = PromptTemplate.fromTemplate(template);

    const model = this.models.get(type);
    if (!model) {
      throw new Error(`Model ${type} not initialized`);
    }

    const chain = RunnableSequence.from([
      _promptTemplate,
      model,
      new StringOutputParser(),
    ]);

    try {
      const response = await chain.invoke({
        LANGUAGE: language,  
        SELECTION: selection 
      });

      return response;
    } catch (error) {
      console.error(`Error in ${type} explanation:`, error);
      throw error;
    }
  }

  isModelAvailable(type: AgentsType): boolean {
    return this.models.has(type);
  }
}

// 创建单例实例
export const langchainService = new LangchainService(); 
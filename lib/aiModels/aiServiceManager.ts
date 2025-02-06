import { AgentsType } from '@/typings/aiModelAdaptor';
import { langchainService } from './langchainService';
import { agentsStorage } from '@/utils/storage';

export class AIServiceManager {
  private static instance: AIServiceManager;
  private initialized = false;

  private constructor() {}

  static getInstance(): AIServiceManager {
    if (!AIServiceManager.instance) {
      AIServiceManager.instance = new AIServiceManager();
    }
    return AIServiceManager.instance;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const agents = await agentsStorage.getValue();
      if (!agents) return;

      for (const agent of agents) {
        await langchainService.initializeModel(
          agent.agentName,
          agent.apiKey
        );
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
      throw error;
    }
  }

  async getExplanation(selection: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 获取所有已配置的模型
    const agents = await agentsStorage.getValue() || [];
    
    // 按配置顺序尝试不同的模型
    for (const agent of agents) {
      if (langchainService.isModelAvailable(agent.agentName)) {
        try {
          return await langchainService.explain(agent.agentName, selection);
        } catch (error) {
          console.error(`Failed to get explanation from ${agent.agentName}:`, error);
          continue;
        }
      }
    }

    throw new Error('No available AI service');
  }
}

export const aiServiceManager = AIServiceManager.getInstance(); 
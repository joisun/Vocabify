import { AgentsType } from "@/typings/aiModelAdaptor";
import { API_ERROR_TYPE, RequestFn } from "@/typings/app";
import { APIException } from "@/utils/APIException";
import { log } from "@/utils/app";

export async function chatComplete(message: string) {
  return browser.runtime.sendMessage({ type: "chatCompletion", data: message });
}

// 定义 AI 接口的统一结构
export interface AIModelInterface {
  /**API 的 名字 */
  name?: AgentsType;
  /**API 的 URL 请求地址 */
  apiUrl?: string;
  /**API 所应用的模型列表 */
  modelList: string[];
  chatCompletion(input: string): Promise<string>;
}

export class AiApiBasic implements AIModelInterface {
  name: AgentsType;
  apiUrl: string;
  modelList: string[];
  requestFn: RequestFn;
  constructor(
    name: AgentsType,
    apiUrl: string,
    modelList: string[],
    requestFn: RequestFn
  ) {
    this.modelList = modelList;
    this.name = name;
    this.apiUrl = apiUrl;
    this.requestFn = requestFn;
  }
  // AI 服务应该在自己内部尝试多轮 模型尝试,直到全部失败才抛出错误
  async chatCompletion(input: string): Promise<string> {
    const apiKey = await getAgentApiKey(this.name);
    if (!apiKey) {
      throw new Error(`AI API: ${this.name} 未设置apikey，请在setting中设置`);
    }
    for (const model of this.modelList) {
      try {
        // 依次尝试调用各个服务
        const response = await this.requestFn({
          apikey: apiKey,
          apiUrl: this.apiUrl,
          model: model,
          userMessage: input,
          // maxTokens: await greetingWordsLimit.getValue()
        });
        return Promise.resolve(response);
      } catch (error) {
        if (error instanceof APIException) {
          log(
            `${this.name} API failed for model ${model}: \n ${error.type}: ${error.message}`,
            "error"
          );
        }
        continue; // 尝试下一个model
      }
    }
    // 如果所有模型的请求都失败了,那么就会抛出错误
    throw new APIException(
      `All Model for ${this.name} services failed`,
      API_ERROR_TYPE.APIError
    );
  }
}

/**
 * AI 接口调度器, 自动化尝试调用各个 AI 服务, 包括所有 AI 接口提供的不同模型
 */
export class AiApiAdaptor {
  private services!: AIModelInterface[];
  private toRemoveServices: AIModelInterface[] = [];
  constructor() {}

  /**
   * Initialize the AI model services to be used in the current session. The input services
   * will be filtered by the agentApiKeys stored in the storage. The agentApiKeys will be
   * mapped to the corresponding AI model services and the services that do not have a
   * corresponding agentApiKey will be filtered out.
   * @param services The AI model services to be used in the current session.
   * @returns A promise that resolves when the services are initialized.
   */
  initServices(services: AIModelInterface[]) {
    return agentsStorage.getValue().then((agentApiKeys) => {
      this.services = agentApiKeys
        .map((agentApi) => {
          return services.find(
            (service) => service.name === agentApi.agentName
          )!;
        })
        .filter((service) => service !== undefined);
    });
  }
  /**
   * 当某个服务请求失败的时候，就在该轮循环中结束的时候，暂时移除，避免每次都重试该失败的 服务
   */
  private removeInvalidServices() {
    for (const service of this.toRemoveServices) {
      const index = this.services.indexOf(service);
      if (index !== -1) {
        this.services.splice(index, 1); // 从数组中删除元素
        log(`暂时移除无效的 API 服务 ${service.name}`, "warn");
      }
    }
  }

  async chat(input: string): Promise<string> {
    if (!this.services) {
      throw new APIException(
        "Services is not prepared! Please initialize the AiApiAdaptor first.",
        API_ERROR_TYPE.APINETEXCEPTION
      );
    }

    for (const service of this.services) {
      try {
        // 依次尝试调用各个服务
        const response = await service.chatCompletion(input);
        this.removeInvalidServices();
        return response;
      } catch (error) {
        if (error instanceof APIException) {
          log(`${error.type}: ${error.message} `, "error");
        }
        // 收集需要移除的 service
        this.toRemoveServices.push(service);
        console.log("error", error);
        continue; // 尝试下一个服务
      }
    }
    throw new APIException("All AI services failed", API_ERROR_TYPE.APIError);
  }
}

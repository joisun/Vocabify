import { AiAgentApiKeys } from "@/typings/aiModelAdaptor";

/** 自定义 Prompt */
export const promptTemplate = storage.defineItem<string>(
  "local:additionalPrompt",
  {
    fallback: "",
  }
);

/** 目标语言 */
export const targetLanguage = storage.defineItem<string>(
  "local:targetLanguage",
  {
    fallback: "",
  }
);

/** apikey 设定缓存 */
export const agentsStorage = storage.defineItem<AiAgentApiKeys>(
  "local:agents",
  {
    fallback: [],
  }
);

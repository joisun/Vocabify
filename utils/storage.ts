import { AiAgentApiKeys } from "@/typings/aiModelAdaptor";
import { DefaultPromptTemplate, DefaultLanguage } from "@/const";

/** 自定义 Prompt */
export const promptTemplate = storage.defineItem<string>(
  "local:additionalPrompt",
  {
    fallback: DefaultPromptTemplate,
  }
);

/** 目标语言 */
export const targetLanguage = storage.defineItem<string>(
  "local:targetLanguage",
  {
    fallback: DefaultLanguage,
  }
);

/** apikey 设定缓存 */
export const agentsStorage = storage.defineItem<AiAgentApiKeys>(
  "local:agents",
  {
    fallback: [
      {
          "agentName": "ChatAnywhere",
          "apiKey": "sk-M72D5lilVXr4dKsWwPJgs8PRzvnLQleW0UrpBKdjjm7hHWWL"
      },
      {
          "agentName": "XunFeiSpark",
          "apiKey": "MTrricoschHlfxWNvIJD:ZXklDofIqPdoBxkWsjTA"
      }
  ],
  }
);

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
        agentName: "XunFeiSpark",
        apiKey: "MTrricoschHlfxWNvIJD:ZXklDofIqPdoBxkWsjTA",
      },
      {
        agentName: "ChatAnywhere",
        apiKey: "sk-M72D5lilVXr4dKsWwPJgs8PRzvnLQleW0UrpBKdjjm7hHWWL",
      },
    ],
  }
);



/**
 * selections 队列
 * 用于解决，background 首次打开 side panel 的时候， side panel 中的消息监听还未初始化，导致消息事件不执行的问题。
 */
export const firstSelection = storage.defineItem<string[]>("session:firstSelection", {
  fallback: [],
});

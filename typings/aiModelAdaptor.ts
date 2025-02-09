export enum AgentsType {
    "XunFeiSpark" = "XunFeiSpark",
    "ChatAnywhere" = "ChatAnywhere",
    "Kimi" = "Kimi",
    "OpenAIturbo" = "OpenAI 3.5 turbo",
    "GPT4o" = "OpenAI 4o",
    "GPT4oMini"= "OpenAI 4o mini",
}
export type AiAgentApiKey = {
    agentName: AgentsType,
    apiKey: string
}
export type AiAgentApiKeys = AiAgentApiKey[]



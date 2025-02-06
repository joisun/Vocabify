export enum AgentsType {
    "XunFeiSpark" = "XunFeiSpark",
    "ChatAnywhere" = "ChatAnywhere",
    "Kimi" = "Kimi",
    "OpenAI" = "OpenAI"
}
export type AiAgentApiKey = {
    agentName: AgentsType,
    apiKey: string
}
export type AiAgentApiKeys = AiAgentApiKey[]



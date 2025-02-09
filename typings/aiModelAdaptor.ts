export enum AgentsType {
  XunFeiSpark = 'XunFeiSpark',
  XunFeiSpark_Lite = 'XunFeiSpark Lite',
  XunFeiSpark_Pro = 'XunFeiSpark Pro',
  XunFeiSpark_Pro_128K = 'XunFeiSpark Pro-128K',
  XunFeiSpark_Max = 'XunFeiSpark Max',
  XunFeiSpark_Max_32K = 'XunFeiSpark Max-32K',
  XunFeiSpark_4Ultra = 'XunFeiSpark 4.0 Ultra',
  ChatAnywhere_GPT4oMini = 'ChatAnywhere GPT-4o Mini',
  ChatAnywhere_GPT35Turbo = 'ChatAnywhere GPT-3.5 Turbo',
  ChatAnywhere_GPT4o = 'ChatAnywhere GPT-4o',
  ChatAnywhere_GPT4 = 'ChatAnywhere GPT-4',
  Kimi_Moonshot_8K = 'Kimi Moonshot 8K',
  Kimi_Moonshot_32K = 'Kimi Moonshot 32K',
  Kimi_Moonshot_128K = 'Kimi Moonshot 128K',
  OpenAI_GPT4o = 'OpenAI GPT-4o',
  OpenAI_GPT4o_Mini = 'OpenAI GPT-4o Mini',
  OpenAI_GPT4_Turbo = 'OpenAI GPT-4 Turbo',
  OpenAI_GPT4 = 'OpenAI GPT-4',
  OpenAI_GPT4_32K = 'OpenAI GPT-4 32K',
  OpenAI_GPT3_5_Turbo = 'OpenAI GPT-3.5 Turbo',
  OpenAI_GPT3_5_Turbo_Instruct = 'OpenAI GPT-3.5 Turbo Instruct',
  OpenAI_O1 = 'OpenAI O1',
  OpenAI_O1_Mini = 'OpenAI O1 Mini',
  OpenAI_O3_Mini = 'OpenAI O3 Mini',
}

export type AiAgentApiKey = {
  agentName: AgentsType
  apiKey: string
}

export type AiAgentApiKeys = AiAgentApiKey[]

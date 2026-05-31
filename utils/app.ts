import { LoggerType } from '@/typings/app'
import { getNormalizedAgents } from '@/utils/storage'

export function log(msg: string, type: LoggerType = 'info') {
  const message = `[${new Date().toLocaleTimeString()} Findjob-bot]: ${msg}`
  sendLog({
    message,
    type,
  })
  switch (type) {
    case 'error':
      console.error(message)
      break
    case 'info':
      console.log(message)
      break
    case 'warn':
      console.warn(message)
      break
    default:
      break
  }
}

function sendLog(msg: { message: string; type: LoggerType }) {
  browser.runtime.sendMessage({
    type: 'findjob-bot-logger',
    data: msg,
  })
}

export async function getAgentApiKey(providerId: string) {
  const keys = await getNormalizedAgents()
  return keys.find((agent) => agent.providerId === providerId)?.apiKey
}

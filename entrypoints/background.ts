import { onMessage } from '@/lib/messaging'
import { hightlightStyle } from '@/utils/storage'
import { aiService } from '@/lib/aiService'

export default defineBackground(() => {
  console.log('Vocabify background started', { id: browser.runtime.id })

  // Handle getting highlight style settings
  onMessage('getHighlightStyleSettings', async () => {
    return (await hightlightStyle.getValue()) || null
  })

  // Handle trigger selection - will be used for AI streaming via Port
  onMessage('triggerSelection', async (message) => {
    return { status: 'ok' as const }
  })

  onMessage('openOptionsPage', async () => {
    await chrome.runtime.openOptionsPage()
    return { status: 'ok' as const }
  })

  onMessage('githubStartDeviceFlow', async ({ data }) => {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: data.clientId,
        scope: data.scope,
      }),
    })
    return readGitHubJson(response)
  })

  onMessage('githubPollDeviceToken', async ({ data }) => {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: data.clientId,
        device_code: data.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })
    return readGitHubJson(response)
  })

  onMessage('githubGetUser', async ({ data }) => {
    const response = await githubFetch(data.token, 'https://api.github.com/user')
    const user = await readGitHubJson(response) as { login?: string }
    if (!user.login) throw new Error('GitHub user response did not include login')
    return { login: user.login }
  })

  onMessage('githubEnsureRepo', async ({ data }) => {
    const userResponse = await githubFetch(data.token, 'https://api.github.com/user')
    const user = await readGitHubJson(userResponse) as { login?: string }
    if (!user.login) throw new Error('GitHub user response did not include login')

    const repoUrl = `https://api.github.com/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(data.repoName)}`
    const repoResponse = await githubFetch(data.token, repoUrl)
    if (repoResponse.ok) return { created: false }
    if (repoResponse.status !== 404) await readGitHubJson(repoResponse)

    const createResponse = await githubFetch(data.token, 'https://api.github.com/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: data.repoName,
        description: 'Private repository for Vocabify vocabulary sync data',
        private: true,
        is_template: false,
      }),
    })
    await readGitHubJson(createResponse)
    return { created: true }
  })

  onMessage('githubGetFile', async ({ data }) => {
    const url = `https://api.github.com/repos/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}/contents/${encodeURIComponent(data.path)}`
    const response = await githubFetch(data.token, url)
    if (response.status === 404) return { exists: false }
    const file = await readGitHubJson(response) as { sha?: string; content?: string }
    return {
      exists: true,
      sha: file.sha,
      content: file.content,
    }
  })

  onMessage('githubPutFile', async ({ data }) => {
    const url = `https://api.github.com/repos/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}/contents/${encodeURIComponent(data.path)}`
    const response = await githubFetch(data.token, url, {
      method: 'PUT',
      body: JSON.stringify({
        message: data.message,
        content: data.content,
        ...(data.sha ? { sha: data.sha } : {}),
      }),
    })
    const result = await readGitHubJson(response) as { content?: { sha?: string } }
    return { sha: result.content?.sha }
  })

  // Handle AI streaming via Port
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'ai-stream') {
      let disconnected = false
      const abortController = new AbortController()
      const postToPort = (message: unknown) => {
        if (disconnected) return
        try {
          port.postMessage(message)
        } catch (error) {
          disconnected = true
          console.warn('AI stream port is no longer available:', error)
        }
      }

      port.onDisconnect.addListener(() => {
        disconnected = true
        abortController.abort()
      })

      port.onMessage.addListener(async (msg) => {
        if (msg.type === 'start' && msg.text) {
          try {
            await aiService.streamExplanation({
              text: msg.text,
              abortSignal: abortController.signal,
              onChunk: (chunk) => {
                postToPort({ type: 'chunk', chunk })
              },
              onComplete: (fullText) => {
                postToPort({ type: 'complete', fullText })
              },
              onError: (error) => {
                postToPort({ type: 'error', error: error.message })
              }
            })
          } catch (error) {
            postToPort({
              type: 'error',
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      })
    }
  })
})

function githubFetch(token: string, url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  })
}

async function readGitHubJson(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof data?.message === 'string'
      ? data.message
      : `${response.status} ${response.statusText}`
    throw new Error(`GitHub request failed: ${message}`)
  }
  return data
}

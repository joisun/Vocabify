// 用户首次点击同步
// 获取用户access_token
// 获取用户是否有名为 Vocabify 的仓库
// 如果有则获取该仓库的内容
// 如果没有则创建该仓库
// 将内容存储到本地
// 将内容和本地存储的内容进行比对，如果有不同则更新本地存储

// Octokit.js
// https://github.com/octokit/core.js#readme
import { Octokit } from 'octokit'
import VocabifyIndexDB from './db'
import { Base64 } from 'js-base64';
const REPO_NAME = '__Vocabify_Data_Center__'



export const checkTokenValidity = async (token: string): Promise<boolean> => {
  const octokit = new Octokit({
    auth: token,
  })
  try {
    await octokit.request('GET /user', {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    return true
  } catch (error) {
    console.error('Token is invalid or expired:', error)
    return false
  }
}

export const createRepo = async (token: string) => {
  const octokit = new Octokit({
    auth: token,
  })
  try {
    const response = await octokit.request('POST /user/repos', {
      name: REPO_NAME,
      description: 'Repository for Vocabify extension data',
      homepage: 'https://github.com',
      private: true,
      is_template: false,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    return response
  } catch (error) {
    console.error('Error creating repository:', error)
    throw error
  }
}

export const repoExists = async (token: string) => {
  const octokit = new Octokit({
    auth: token,
  })
  try {
    let page = 1
    let repos: any[] = []
    let hasMore = true

    while (hasMore) {
      const response = await octokit.request('GET /user/repos', {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
        per_page: 100,
        page,
      })
      repos = repos.concat(response.data)
      hasMore = response.data.length === 100
      page++
    }

    return repos.some((repo: { name: string }) => repo.name === REPO_NAME)
  } catch (error) {
    console.error('Error checking repository existence:', error)
    throw error
  }
}

export const getUsername = async (token: string) => {
  const octokit = new Octokit({
    auth: token,
  })
  try {
    const response = await octokit.request('GET /user', {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    return response.data.login
  } catch (error) {
    console.error('Error fetching user information:', error)
    throw error
  }
}

export const syncDataToRepo = async (token: string, repoName: string, data: any) => {
  const octokit = new Octokit({
    auth: token,
  })
  try {
    const username = await getUsername(token)
    const content = Base64.encode(JSON.stringify(data))

    // Get the current file's SHA
    let sha: string | undefined = undefined
    try {
      const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: username,
        repo: repoName,
        path: 'syncdata.json',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if ('sha' in response.data) {
        sha = response.data.sha
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error as any).status !== 404) {
        throw error
      }
    }

    const response = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner: username,
      repo: repoName,
      path: 'syncdata.json',
      message: 'Sync data to GitHub',
      content,
      sha,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    return response
  } catch (error) {
    console.error('Error syncing data to repository:', error)
    throw error
  }
}

export const fetchDataFromRepo = async (token: string, repoName: string) => {
  const octokit = new Octokit({
    auth: token,
  })
  try {
    const username = await getUsername(token)
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: username,
      repo: repoName,
      path: 'syncdata.json',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if ('content' in response.data) {
      const content = Base64.decode(response.data.content)
      return JSON.parse(content)
    }
    throw new Error('Invalid response data')
  } catch (error: unknown) {
    if (error instanceof Error && (error as any).status === 404) {
      // File not found, return empty array
      return []
    }
    console.error('Error fetching data from repository:', error)
    throw error
  }
}

export const syncLocalAndRemoteData = async (token: string) => {
  type Record = {
    id: number
    meaning: string
    updatedAt: string
    wordOrPhrase: string
    createdAt: string
  }
  const db = new VocabifyIndexDB()
  const localData = (await db.getAllData()) as Record[]
  const remoteData = await fetchDataFromRepo(token, REPO_NAME)
  console.log('localData', localData)
  // If both local and remote data are empty, initialize remote data with an empty array
  if (localData.length === 0 && remoteData.length === 0) {
    await syncDataToRepo(token, REPO_NAME, [])
    return
  }

  // If local data is empty, initialize it with remote data
  if (localData.length === 0 && remoteData.length > 0) {
    for (const remoteRecord of remoteData) {
      await db.addOrUpdateData(remoteRecord)
    }
    return
  }

  // If remote data is empty, sync local data to remote
  if (remoteData.length === 0 && localData.length > 0) {
    await syncDataToRepo(token, REPO_NAME, localData)
    return
  }

  // Compare and update local data with remote data
  for (const remoteRecord of remoteData) {
    const localRecord = await db.getDataByWord(remoteRecord.wordOrPhrase)
    if (!localRecord || localRecord.updatedAt < remoteRecord.updatedAt) {
      await db.addOrUpdateData(remoteRecord)
    }
  }

  // Sync local data to remote
  await syncDataToRepo(token, REPO_NAME, localData)
}

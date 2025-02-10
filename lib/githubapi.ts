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


export const createRepo = async (token: string) => {
    const octokit = new Octokit({
        auth: token,
      })
  return await octokit.request('POST /user/repos', {
    name: 'Hello-World',
    description: 'This is your first repo!',
    homepage: 'https://github.com',
    private: true,
    is_template: true,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

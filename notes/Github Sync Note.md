# WXT + React

This template should help get you started developing with React in WXT.

手动引入了 shadcn:
https://ui.shadcn.com/docs/installation/manual

## 特别注意

    // 这样在不同设备测试的时候， github auth app 中的 Authorization callback URL 可以用一个而不用修改

关于 GitHub auth 登录，
https://github.com/settings/applications/2849083

当前同步实现使用 GitHub OAuth Device Flow：

- GitHub OAuth App 需要开启 `Enable Device Flow`
- 普通用户不需要配置 OAuth App，也不需要手动创建 token
- 插件使用内置 `client_id` 请求 device code，用户在 GitHub 页面输入 code 后完成授权
- 授权成功后，插件将 token 存储在 `chrome.storage.local`
- 词表同步到用户私有仓库 `__Vocabify_Data_Center__` 的 `syncdata.json`


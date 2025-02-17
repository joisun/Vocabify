# WXT + React

This template should help get you started developing with React in WXT.

手动引入了 shadcn:
https://ui.shadcn.com/docs/installation/manual

## 特别注意

    // 这样在不同设备测试的时候， github auth app 中的 Authorization callback URL 可以用一个而不用修改

关于 github auth 登录，
https://github.com/settings/applications/2849083
需要配置： Authorization callback URL
这个地址需要保持 和 entrypoints/sidepanel/components/Layout.tsx 中

```js
const redirectUri = chrome.identity.getRedirectURL()
```

的打印值一样。

这个值的模式为： `https://<extension-id>.chromiumapp.org`, 例如

"https://epjdeemhdnficcedfnpigckjpbfgimmc.chromiumapp.org"

但是，Authorization callback URL 地址只能够配置一个， 而 extension id 在测试环境，每台设备的 id 值可能不一样， 所以如果在多台设备开发测试，那么这个 地址 就和多台设备可能对不上，导致 “invalid redirect-uri” 的错误。 并且，在生产环境，上传到 chrome 商店后， extension id 则是固定的。因此如果上线了 Authorization callback URL 地址需要配置为携带正式 extension id 的 url。

为了解决这个问题， 我在 manifest 中新增了一个 key 值（任意的）， 它会使得在开发环境下， extension-id 也是固定值

```
    key: 'thisissolidextensionidfordevvvvv',
```

计算的 extension-id 为： gfgcoeiecfmeebokpanajegnfohjagpo
（在扩展中点扩展的详情，地址栏就可以看到）

测试的时候，需要将 Authorization callback URL 改为： `https://gfgcoeiecfmeebokpanajegnfohjagpo.chromiumapp.org`

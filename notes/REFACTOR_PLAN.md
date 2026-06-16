# Vocabify 全量升级重构计划 (Refactoring Roadmap)

> 版本：v2（2026-05-13 完善）
> 原始计划由 Gemini 生成，本版本补充了遗漏的关键问题和实施细节。

---

## 🎯 核心架构变更与痛点分析

### 1. 【重大交互变更】废弃 Sidepanel，拥抱页内交互 (In-page UI)

**当前痛点**：Sidepanel 的打开逻辑受限（有时需要用户主动点击 Extension Icon），导致用户在使用划词翻译时，必须分心去管理 Sidepanel 的状态，破坏了沉浸式的阅读体验。

**重构方案**：完全废弃 `sidepanel` 目录。使用 Content Script 将 UI（如 Sheet 抽屉、Modal 模态框或大尺寸的 Popover）直接注入到当前宿主页面中。

**技术选型**：使用 **Shadow DOM** 配合 React 渲染这些复杂的组件，以确保 Shadcn UI 和 TailwindCSS 的样式不会受到宿主页面 CSS 的污染（CSS Isolation）。

**遗漏的细节**：
- Shadow DOM 内部需要手动注入 Tailwind 样式表（`adoptedStyleSheets` 或 `<style>` 注入），否则 Tailwind 类名不生效
- 需要处理宿主页面 `z-index` 堆叠上下文问题，建议使用 `position: fixed` + 极高 `z-index`
- 需要处理宿主页面阻止事件冒泡的情况（某些 SPA 框架会拦截 keydown/click）
- Popup 页面的职责需要重新定义：废弃 Sidepanel 后，Popup 可作为词库管理入口（查看、搜索、导出）

---

### 2. 性能隐患：DOM 划词高亮实现机制

**当前痛点**：目前代码中遍历所有 textNode 并通过 `range.deleteContents()` + `range.insertNode(container)` 然后挂载 React Root 的方式，会严重破坏原有网页的 DOM 结构。在包含大量文本的页面上会导致严重的内存占用和页面重排抖动。

**重构方案**：使用 **[CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)**。它可以实现纯 CSS 层面的文本高亮，**完全不改变 DOM 树结构**，性能极佳。配合一个全局单例的 React Portal/Overlay 层来处理鼠标悬浮弹出的 Tooltip。

**遗漏的细节**：
- CSS Custom Highlight API 目前 Firefox 支持度有限（Firefox 117+ 才支持），需要做 feature detection + fallback
- Fallback 方案：使用 `<mark>` 标签包裹（比当前的 React Root 方案轻量得多）
- 高亮 Tooltip 的触发需要通过 `mousemove` + `document.caretRangeFromPoint()` 定位，而非 DOM 事件委托
- 页面导航（SPA 路由切换）时需要重新触发高亮，需监听 `MutationObserver` 或 `popstate`/`pushState`

---

### 3. 数据层：原生 IndexedDB API 过于底层

**当前痛点**：`lib/db.ts` 直接封装原生 API，代码冗长、类型支持弱，难以响应式地驱动 UI 更新。

**重构方案**：引入 **`dexie`** (及其 React Hooks)。这不仅能极大简化 DB 操作，还能让页内 UI (如单词列表弹窗) 通过 `useLiveQuery` 实时响应数据库变化，避免通过 message 满天飞地同步状态。

**遗漏的细节**：
- Dexie 在 Content Script 环境中可以直接使用，但需要注意 Content Script 和 Background 共享同一个 IndexedDB origin（`chrome-extension://`），可以直接在 Content Script 中读写，**无需再通过 Background 中转**
- 这意味着 `background.ts` 中大量的 DB 消息处理器（`saveWordOrPhrase`、`findByPage`、`fuzzySearchByKeyword`、`deleteWordOrPhrase`、`getAllRecordsData`）可以全部删除，大幅简化消息协议
- 需要定义 Dexie schema 版本迁移策略，兼容现有用户的 IndexedDB 数据（当前 DB 名为 `VocabifyDB`，store 名为 `wordOrPhrases`）
- 现有数据结构：`{ wordOrPhrase, meaning, id, createdAt, updatedAt }`，迁移时需保持字段兼容

---

### 4. AI 服务层：拥抱 Vercel AI SDK

**当前痛点**：引入了完整的 LangChain 核心库，增加了巨大的打包体积，影响插件加载和初始化速度。

**重构方案**：彻底移除 LangChain。改用 **[Vercel AI SDK (`ai` package)](https://sdk.vercel.ai/docs)**。

**优势**：
- **极简适配**：Vercel AI SDK 提供了极其统一且轻量的 `streamText` 接口，原生支持 OpenAI、Kimi (Moonshot)、Anthropic 等
- **极致体积**：模块化设计，Tree Shaking 友好，显著减小插件体积
- **原生流式**：在 Background 处理流式请求并通过 Port 传回 UI，规避跨域并提升响应速度

**遗漏的细节**：
- Vercel AI SDK 的 `streamText` 依赖 `fetch` streaming，在 Chrome Extension Service Worker 中需要验证兼容性（MV3 Service Worker 支持 streaming fetch，但有超时限制）
- 讯飞 Spark 使用 WebSocket 协议，Vercel AI SDK 不原生支持，需要保留自定义适配器或考虑是否继续支持讯飞
- 当前设计已取消"按顺序尝试多个模型"的 fallback 逻辑，仅使用用户配置的单个 active provider
- 流式响应需要通过 `chrome.runtime.Port`（长连接）传回 Content Script，而非 `sendMessage`（一次性消息）——这是流式的关键，原计划未提及
- 需要处理 Service Worker 被浏览器休眠后重新激活的场景（MV3 的 Service Worker 生命周期问题）

---

## 🔴 原计划遗漏的重要问题

### 5. 消息协议重构（ProtocolMap 大幅简化）

**当前问题**：`lib/messaging.ts` 中定义了大量消息类型，其中很多是因为 Sidepanel 架构和 Background 中转 DB 操作而存在的。重构后这些消息可以删除。

**重构后保留的消息**（Background 仍需处理的）：
- `triggerSelection` → Content Script 通知 Background 打开 In-page UI（或直接在 Content Script 内处理，Background 可能不再需要）
- `sendToAi` / AI 流式 Port → 调用 AI 服务（Background 负责，因为 Content Script 有 CORS 限制）
- `getHighlightStyleSettings` → 可改为 Content Script 直接读 WXT Storage，无需 Background 中转

**可删除的消息**：
- `openSidePanel`、`sidePanelPrepared`、`sidePanelClosed`（Sidepanel 废弃）
- `saveWordOrPhrase`、`findByPage`、`fuzzySearchByKeyword`、`deleteWordOrPhrase`、`getAllRecordsData`（DB 操作移到 Content Script 直接用 Dexie）

---

### 6. Options 页面重构

**当前问题**：Options 页面有大量组件（`ApiKeysConfigComponent`、`PromptTemplate`、`TargetLanguageSetting`、`UserInterfaceSettings` 等），但 git status 显示这些文件都被删除了（` D` 状态），说明重构已经开始但 Options 页面尚未重建。

**需要明确**：
- Options 页面是否继续保留为独立页面，还是整合进 Popup？
- 建议：保留 Options 页面，但用 shadcn 组件重写，去掉 `global-over-write.css` 这种 hack

---

### 7. Popup 页面职责重定义

**当前问题**：`popup/App.tsx` 已被删除（` D` 状态），Popup 的新职责尚未定义。

**建议方案**：
- Popup 作为轻量入口：显示当前页面已保存的词汇数量、快速跳转到 Options、触发词库管理面板
- 词库管理（查看/搜索/删除/导出）移到 In-page UI 的一个 Tab 中，或保留在 Popup 中

---

### 8. 样式隔离方案的完整性

**当前问题**：原计划提到 Shadow DOM + Tailwind，但没有说明具体实现路径。

**完整方案**：
```
Content Script 挂载点
└── Shadow Host (<div id="vocabify-root">)
    └── Shadow Root
        ├── <style> (注入编译后的 Tailwind CSS)
        └── React App (通过 ReactDOM.createRoot(shadowRoot))
```

**关键问题**：
- WXT 构建时需要将 Tailwind CSS 输出为独立文件，然后在 Content Script 中通过 `fetch(chrome.runtime.getURL('content-styles.css'))` 读取并注入 Shadow DOM
- 或者使用 `?inline` import（Vite 支持）直接将 CSS 作为字符串 import，避免额外的网络请求
- shadcn 组件的 CSS 变量（`--background`、`--foreground` 等）需要在 Shadow Root 内的 `:host` 上定义，而非 `:root`

---

### 9. GitHub 同步功能的去留

**当前状态**：`lib/githubapi.ts` 存在，`utils/storage.ts` 中有 `githubAccessToken`，但功能似乎未完全实现。

**需要决策**：
- 是否在本次重构中实现 GitHub 同步？
- 如果保留，需要明确同步触发时机（手动 vs 自动）和冲突解决策略

---

### 10. 构建体积优化（补充）

**当前问题**：除了 LangChain，还有其他体积问题：
- `react-virtualized`（重量级虚拟列表库）→ 可替换为更轻量的 `@tanstack/react-virtual` 或 `react-window`
- `typed.js`（打字机效果）→ 可用纯 CSS animation 或简单的 `setInterval` 替代
- `react-keep-alive`（组件缓存）→ 废弃 Sidepanel 后可能不再需要
- 拖拽排序依赖已移除，provider 配置不再表达优先级

---

## 📋 重构实施顺序建议

重构涉及多个相互依赖的模块，建议按以下顺序进行，每个阶段独立可验证：

### Phase 1：数据层（风险最低，收益最高）
1. 引入 Dexie，定义 schema（兼容现有数据结构）
2. 替换 `lib/db.ts`，删除 Background 中的 DB 消息处理器
3. 验证：Content Script 可直接读写 IndexedDB

### Phase 2：AI 服务层
1. 引入 Vercel AI SDK
2. 替换 LangChain，保留 PromptTemplate，AI 查询仅使用单个 active provider
3. 实现 Background → Content Script 的流式 Port 通信
4. 验证：流式 AI 响应正常工作

### Phase 3：In-page UI 基础设施
1. 搭建 Shadow DOM 容器 + Tailwind 注入方案
2. 迁移 `RootContainer.tsx`，验证 shadcn 组件在 Shadow DOM 内正常渲染
3. 实现基础的 In-page Sheet/Drawer 组件

### Phase 4：核心功能迁移
1. 将 Sidepanel 的词库管理 UI 迁移到 In-page UI
2. 将 AI 解释展示迁移到 In-page UI
3. 删除 `sidepanel/` 目录

### Phase 5：高亮机制升级
1. 实现 CSS Custom Highlight API 方案（含 feature detection）
2. 实现 Fallback 方案
3. 实现 MutationObserver 监听 SPA 路由变化

### Phase 6：消息协议清理 & Options/Popup 重建
1. 删除废弃的消息类型
2. 重建 Options 页面（shadcn 组件）
3. 重定义 Popup 职责并实现

### Phase 7：依赖清理 & 体积优化
1. 移除 LangChain、react-keep-alive、typed.js 等废弃依赖
2. 评估并替换 react-virtualized
3. 构建体积对比验证

---

## ⚠️ 高风险点汇总

| 风险点 | 风险等级 | 说明 |
|--------|----------|------|
| Shadow DOM + Tailwind 样式注入 | 🔴 高 | 需要 Vite 构建配置配合，调试困难 |
| MV3 Service Worker 流式响应 | 🔴 高 | Service Worker 生命周期限制，需要充分测试 |
| 讯飞 Spark WebSocket 适配 | 🟡 中 | Vercel AI SDK 不支持，需要决策是否保留 |
| Dexie 数据迁移兼容性 | 🟡 中 | 现有用户数据不能丢失 |
| CSS Custom Highlight API 兼容性 | 🟡 中 | Firefox 支持有限，需要 fallback |
| SPA 页面高亮重触发 | 🟡 中 | MutationObserver 性能开销需要控制 |
| Popup 职责重定义 | 🟢 低 | 功能明确，实现简单 |

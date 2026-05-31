# Playwright E2E Testing Implementation Plan

> Current plan reflects the WXT development-extension workflow. Do not implement E2E by launching a separate persistent Chromium context with `.output/chrome-mv3` and `--load-extension`.

**Goal:** Maintain a professional Playwright E2E suite for Vocabify's real browser-extension workflow.

**Architecture:** Run `pnpm run dev`, connect Playwright to WXT's existing Chromium through CDP, and test the dev extension in place.

**Tech Stack:** Playwright, TypeScript, WXT, Chrome DevTools Protocol.

## Task 1: Environment Setup

**Files:**

- `package.json`
- `pnpm-lock.yaml`
- `wxt.config.ts`

Implementation:

- Add `@playwright/test`.
- Add `"test:e2e": "playwright test"`.
- Ensure `wxt.config.ts` includes:

```ts
webExt: {
  chromiumArgs: [
    "--enable-unsafe-extension-debugging",
    "--remote-debugging-port=9222",
  ],
}
```

## Task 2: Content UI Runtime

**Files:**

- `entrypoints/content/index.tsx`
- `components/ui/sheet.tsx`

Implementation:

- Use `cssInjectionMode: "ui"` on the content script.
- Mount content UI with `createShadowRootUi`.
- Set the Shadow host id to `vocabify-root`.
- Create a dedicated `#vocabify-react-root` for React.
- Create `#vocabify-portal-root` inside the ShadowRoot and point Sheet portals at it.

Acceptance:

- Tailwind classes apply inside ShadowRoot.
- Selection toolbar and Sheet are queryable under `#vocabify-root`.
- There is no React warning about mounting directly to `document.body`.

## Task 3: Selection AI Flow Test

**Files:**

- `tests/selection-ai-flow.spec.ts`
- `tests/fixtures/selection-page.html`

Implementation:

- Connect to the existing WXT Chrome:

```ts
const response = await fetch("http://127.0.0.1:9222/json/version")
const { webSocketDebuggerUrl } = await response.json()
const browser = await chromium.connectOverCDP(webSocketDebuggerUrl)
```

- Resolve extension id from the service worker URL.
- Seed `chrome.storage.local` from the extension options page.
- Select text on a local fixture page.
- Assert the compact toolbar appears.
- Click Explain.
- Assert the sheet appears inside ShadowRoot.
- Assert streamed AI result appears and Save becomes enabled.

Current runtime contract:

- Provider selection is fixed and shown as a single Vercel AI SDK first-party provider list plus Custom Provider.
- Custom providers remain supported as OpenAI-compatible endpoints with a user-provided `baseURL`.
- Model discovery happens dynamically after API key entry, with static fallbacks.
- First-party providers use their official `@ai-sdk/*` packages through `streamText`; only Custom Provider uses `@ai-sdk/openai-compatible`.

Run:

```bash
fnm exec --using v24.13.1 pnpm test:e2e tests/selection-ai-flow.spec.ts
```

## Task 4: Validation Commands

Run in order:

```bash
fnm exec --using v24.13.1 pnpm compile
fnm exec --using v24.13.1 pnpm test:e2e tests/selection-ai-flow.spec.ts
fnm exec --using v24.13.1 pnpm build
```

Expected:

- TypeScript compile passes.
- E2E passes against the WXT dev extension.
- Production build completes.

Known build warnings:

- Vite/Rolldown deprecation warnings from current toolchain.
- Browserslist database age warning.
- lightningcss warning for `::highlight(vocab-highlight)`.

These warnings do not currently block the build, but should be revisited during build tooling cleanup.

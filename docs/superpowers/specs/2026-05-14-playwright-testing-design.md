# Vocabify Playwright Testing Design

## Goal
Establish a robust automated E2E suite for the Vocabify browser extension using Playwright. The primary regression path is:

1. Select text on a normal web page.
2. Show the compact selection toolbar inside the content-script Shadow DOM.
3. Click Explain.
4. Open the Vocabify sheet.
5. Stream a Gemini explanation.
6. Enable saving the result.

## Architecture

### 1. Dev Extension Runtime
Tests should run against the WXT development extension launched by `pnpm run dev`.

Required runtime assumptions:

- WXT dev server is running.
- Chromium is started by WXT, not by the test.
- `wxt.config.ts` exposes a CDP port with `--remote-debugging-port=9222`.
- Playwright connects to the existing browser through `chromium.connectOverCDP`.

Do not use the old `.output/chrome-mv3` + `--load-extension` approach for development validation. That path misses WXT dev behavior and can hide content-script loading issues.

### 2. Extension ID Detection
The extension id should be read from the MV3 service worker URL:

```ts
const worker = context.serviceWorkers().find((sw) => sw.url().startsWith('chrome-extension://'))
const extensionId = new URL(worker!.url()).host
```

Do not infer the extension id from a Shadow DOM stylesheet link. With `cssInjectionMode: "ui"`, WXT injects content CSS as text into the ShadowRoot, so a `<link>` is not guaranteed to exist.

### 3. Shadow DOM Styling
Content UI uses WXT `cssInjectionMode: "ui"` and `createShadowRootUi` so Tailwind output is injected into the ShadowRoot. This is required for production-like tooltip and sheet styling.

The sheet portal is mounted inside `#vocabify-root` under `#vocabify-portal-root`, so Playwright should query content UI with selectors rooted at `#vocabify-root`.

### 4. AI Provider Strategy
The selection flow test defaults to a mocked Gemini SSE endpoint hosted by the local fixture server, and seeds `chrome.storage.local` with:

- `providerId: gemini`
- `providerLabel: Google Gemini`
- `category: first-party`
- `protocol: gemini-native`
- `model: gemini-2.5-flash-lite`
- `baseURL: <fixture>/gemini` (default mocked mode)
- target language `English`

The mocked endpoint returns chunked SSE data so UI streaming behavior is still validated end-to-end through the runtime port flow.
Live Gemini mode remains available by setting `VOCABIFY_LIVE_GEMINI=1` and `VOCABIFY_GEMINI_API_KEY`.

Provider configuration follows Vercel AI SDK terminology without exposing implementation-only choices in the UI:

- Providers are selected from a fixed list; internal provider categories are stored for routing metadata only.
- Custom providers remain supported as OpenAI-compatible endpoints with `baseURL`, API key, and model fields.
- Model lists are fetched dynamically after an API key is entered, then fall back to static defaults if discovery fails.
- OpenAI-compatible providers use `@ai-sdk/openai-compatible`, Anthropic uses `@ai-sdk/anthropic`, and Gemini uses the native streaming endpoint.

## Current E2E Coverage

`tests/selection-ai-flow.spec.ts` verifies:

- Existing WXT dev Chrome is reachable through CDP.
- The content script injects `#vocabify-root`.
- Selecting `nuanced phrase` opens `[data-testid="vocabify-selection-popover"]`.
- The selection popover is a compact `role="toolbar"` and stays within controlled dimensions.
- Clicking `[data-testid="vocabify-explain-action"]` opens `[data-testid="vocabify-sheet"]` inside ShadowRoot.
- `[data-testid="vocabify-ai-result"]` receives Gemini output.
- `[data-testid="vocabify-save-action"]` becomes enabled.

## Running

Start WXT dev first:

```bash
pnpm run dev
```

Run default mocked flow test:

```bash
fnm exec --using v24.13.1 pnpm test:e2e tests/selection-ai-flow.spec.ts
```

Run live Gemini flow test:

```bash
VOCABIFY_LIVE_GEMINI=1 VOCABIFY_GEMINI_API_KEY='...' fnm exec --using v24.13.1 pnpm test:e2e tests/selection-ai-flow.spec.ts
```

## Error Handling

Tests should fail on product-visible console errors. Radix Dialog dev warnings caused by ShadowRoot `document.getElementById` false positives may be filtered only when the actual `SheetTitle` and `SheetDescription` are present in the ShadowRoot.

## Regression Strategy

- Run `pnpm compile` before E2E.
- Run the live dev-CDP E2E before release work that touches content script UI, AI streaming, Sheet portal behavior, or WXT configuration.
- Run `fnm exec --using v24.13.1 pnpm build` for production bundle validation.

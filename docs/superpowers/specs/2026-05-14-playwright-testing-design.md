# Vocabify Playwright Testing Design

## Goal
Establish a robust automated E2E suite for the Vocabify browser extension using Playwright. The primary regression path is:

1. Select text on a normal web page.
2. Show the compact selection toolbar inside the content-script Shadow DOM.
3. Click Explain.
4. Open the Vocabify sheet.
5. Stream an AI explanation.
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
The selection flow test defaults to a mocked OpenAI-compatible endpoint hosted by the local fixture server, and seeds `chrome.storage.local` with:

- `providerId: custom:mock-compatible`
- `providerLabel: Mock Compatible`
- `model: mock-model`
- `baseURL: <fixture>/v1` (default mocked OpenAI-compatible mode)
- target language `English`

The mocked endpoint returns chunked SSE data, including Vocabify block-stream tags split across chunks, so UI streaming behavior is validated end-to-end through the runtime port flow. JSON chunk cases remain useful as compatibility fallback coverage.
Live Google mode remains available by setting `VOCABIFY_LIVE_GOOGLE=1` and `VOCABIFY_GOOGLE_API_KEY`.

Provider configuration follows the single-active-provider settings model:

- Popular first-party providers are shown as preset choices and store `providerId`, label, API key, and model.
- GLM and Kimi use OpenAI-compatible `baseURL`, API key, and model fields.
- Custom providers use OpenAI-compatible `baseURL`, API key, and model fields via Vercel AI SDK.
- Only one provider is active; there is no fallback chain or drag-and-drop priority ordering.
- Model suggestions may be fetched after an API key is entered, but users can always type the model manually.

## Current E2E Coverage

`tests/selection-ai-flow.spec.ts` verifies:

- Existing WXT dev Chrome is reachable through CDP.
- The content script injects `#vocabify-root`.
- Selecting `nuanced phrase` opens `[data-testid="vocabify-selection-popover"]`.
- Clicking `[data-testid="vocabify-operation-query"]` expands the operation bar into the inline structured card.
- Streaming renders field-level content (`term`, `definition`, `example`) from incomplete block-stream chunks instead of exposing raw protocol text or provider reasoning text.
- The popover width remains stable while streamed fields arrive.
- The save action remains disabled until a complete structured result is available.
- Saved-word hover uses `[data-testid="vocabify-saved-hover-card"]` rather than the selection operation popover, remains open when the pointer moves from the highlighted word onto the card, and covers records that exist before the content UI initializes.
- Selecting text inside nested `pre > code` syntax-highlight spans does not open the selection lookup operation bar.
- Failed AI lookup shows `[data-testid="vocabify-stream-error"]` with the provider error after configured automatic retries are exhausted.
- Popover edit mode inputs remain focusable and editable inside ShadowRoot.
- Theme changes through `chrome.storage.local["vocabify-theme"]` propagate from Options to the content script container.
- `[data-testid="vocabify-save-action"]` becomes enabled.
- The My Wordlist tab exposes `[data-testid="vocabify-github-sync"]` and the GitHub connect action.

## Running

Start WXT dev first:

```bash
pnpm run dev
```

Run default mocked flow test:

```bash
fnm exec --using v24.13.1 pnpm test:e2e tests/selection-ai-flow.spec.ts
```

Run live Google flow test:

```bash
VOCABIFY_LIVE_GOOGLE=1 VOCABIFY_GOOGLE_API_KEY='...' fnm exec --using v24.13.1 pnpm test:e2e tests/selection-ai-flow.spec.ts
```

## Error Handling

Tests should fail on product-visible console errors. Radix Dialog dev warnings caused by ShadowRoot `document.getElementById` false positives may be filtered only when the actual `SheetTitle` and `SheetDescription` are present in the ShadowRoot.

## Regression Strategy

- Run `pnpm compile` before E2E.
- Run the live dev-CDP E2E before release work that touches content script UI, AI streaming, Sheet portal behavior, or WXT configuration.
- Run `fnm exec --using v24.13.1 pnpm build` for production bundle validation.

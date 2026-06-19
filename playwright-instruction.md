# Playwright Instruction for Vocabify

Use this runbook when validating Vocabify with Playwright in future conversations.

## Core Rule

Do not launch a separate Chromium or reload the user's existing extension instance unless explicitly requested.

Vocabify is a WXT extension. The correct Playwright path is:

1. The user or agent runs `pnpm run dev`.
2. WXT starts Chromium with the dev extension loaded.
3. Playwright connects to that existing Chromium through CDP.
4. Tests operate inside the existing browser context.

`wxt.config.ts` already exposes:

```ts
"--remote-debugging-port=9222"
"--user-data-dir=./.wxt/chrome-data"
```

Default CDP endpoint:

```txt
http://127.0.0.1:9222
```

Override with:

```bash
VOCABIFY_DEVTOOLS_URL=http://127.0.0.1:9222
```

## Preferred Commands

Before E2E:

```bash
pnpm run compile
```

Run existing selection/AI flow tests:

```bash
pnpm run test:e2e -- tests/selection-ai-flow.spec.ts
```

Build validation:

```bash
pnpm run build
```

If `pnpm run dev` is not running, Playwright will fail to connect to `127.0.0.1:9222`. Start dev first:

```bash
pnpm run dev
```

## How to Connect Manually

Use Playwright CDP connection, not `chromium.launch`.

```ts
import { chromium } from '@playwright/test'

const devtoolsUrl = process.env.VOCABIFY_DEVTOOLS_URL || 'http://127.0.0.1:9222'

async function getBrowserWsUrl(baseUrl: string) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/json/version`)
  if (!res.ok) throw new Error(`DevTools unreachable at ${baseUrl}: ${res.status}`)
  const meta = await res.json()
  return meta.webSocketDebuggerUrl as string
}

const browser = await chromium.connectOverCDP(await getBrowserWsUrl(devtoolsUrl))
const context = browser.contexts()[0]
if (!context) throw new Error(`No browser context at ${devtoolsUrl}. Run pnpm dev first.`)
```

## Extension ID Detection

Resolve the extension id from the MV3 service worker URL. Do not infer it from stylesheet links or Shadow DOM content.

```ts
async function getExtensionId(context: BrowserContext) {
  const workers = context.serviceWorkers().filter((sw) => sw.url().startsWith('chrome-extension://'))
  for (const worker of workers) {
    const id = new URL(worker.url()).host
    if (await canOpenOptionsPage(context, id)) return id
  }

  const worker = await context.waitForEvent('serviceworker', {
    predicate: (sw) => sw.url().startsWith('chrome-extension://'),
    timeout: 10_000,
  })
  return new URL(worker.url()).host
}
```

Validate stale ids by opening:

```txt
chrome-extension://<extensionId>/options.html
```

## Shadow DOM Access

Content UI is mounted under `#vocabify-root` with a ShadowRoot.

Use `page.evaluate` to query inside the ShadowRoot:

```ts
await page.evaluate(() => {
  const root = document.getElementById('vocabify-root')
  const shadow = root?.shadowRoot
  const button = shadow?.querySelector('[data-testid="vocabify-operation-query"]') as HTMLButtonElement | null
  button?.click()
})
```

Common selectors:

```txt
#vocabify-root
[data-testid="vocabify-operation-query"]
[data-testid="vocabify-selection-popover"]
[data-testid="vocabify-stream-term"]
[data-testid="vocabify-stream-definition"]
[data-testid="vocabify-stream-example"]
[data-testid="vocabify-save-action"]
```

## Storage Safety

Do not permanently overwrite the user's configured provider.

When a test must seed `chrome.storage.local`, snapshot first and restore in `finally`.

Current e2e helper in `tests/selection-ai-flow.spec.ts` snapshots and restores:

```txt
agents
targetLanguage
```

Use the same pattern for new tests:

```ts
const previous = await page.evaluate(() => chrome.storage.local.get(['agents', 'targetLanguage']))

try {
  await page.evaluate((seed) => chrome.storage.local.set(seed), {
    agents: [{
      providerId: 'custom:mock',
      providerLabel: 'Mock',
      apiKey: 'test-key',
      model: 'mock-model',
      baseURL: mockBaseUrl,
    }],
    targetLanguage: 'English',
  })
} finally {
  await page.evaluate((snapshot) => {
    const updates: Record<string, unknown> = {}
    const removals: string[] = []
    for (const key of ['agents', 'targetLanguage'] as const) {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) updates[key] = snapshot[key]
      else removals.push(key)
    }
    return Promise.all([
      Object.keys(updates).length ? chrome.storage.local.set(updates) : Promise.resolve(),
      removals.length ? chrome.storage.local.remove(removals) : Promise.resolve(),
    ])
  }, previous)
}
```

## AI Streaming Test Strategy

Prefer a local mock OpenAI-compatible SSE endpoint for deterministic E2E.

The mocked endpoint should receive:

```txt
POST /v1/chat/completions
```

Return `text/event-stream` chunks shaped like OpenAI chat completion chunks:

```ts
function chunk(content: string) {
  return {
    id: 'x',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'm',
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  }
}
```

For streaming parser regressions, deliberately split JSON inside string values:

```ts
chunk('```json\n{\n  "term": "nuanced')
chunk(' phrase",\n  "phonetic": "/njuːˈɑːnst/",\n')
chunk('  "senses": [{ "definition": "A subtle')
chunk(' expression conveying detailed meaning" }]')
```

Assert structured fields appear before final completion and raw JSON is not visible.
For multi-word `phrase` selections, assert only `[data-testid="vocabify-stream-definition"]` as the translation. Do not expect `[data-testid="vocabify-stream-example"]`, phonetic text, pos chips, or mnemonic content.

## Manual UI Debugging With Existing Instance

When the user says the existing `pnpm run dev` instance is already configured:

- Connect through CDP to `127.0.0.1:9222`.
- Reuse `browser.contexts()[0]`.
- Do not reload the extension.
- Do not overwrite provider storage unless explicitly testing storage, and restore it afterward.
- Open new pages with `context.newPage()` and close them after the check.
- For options page checks, navigate to `chrome-extension://<extensionId>/options.html`.

## Common Failure Modes

- `DevTools unreachable`: `pnpm run dev` is not running, or WXT did not start Chromium with port `9222`.
- No browser context: connected to the wrong CDP endpoint.
- Wrong extension id: stale service worker id. Verify by opening `options.html`.
- Shadow DOM selector not found: query through `#vocabify-root.shadowRoot`, not `page.locator(...)` directly.
- Test changed user's provider: missing snapshot/restore around `chrome.storage.local`.

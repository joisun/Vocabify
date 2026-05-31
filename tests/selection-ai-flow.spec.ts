import { test, expect, chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const devtoolsUrl = process.env.VOCABIFY_DEVTOOLS_URL || 'http://127.0.0.1:9222'
const runLiveGoogle = process.env.VOCABIFY_LIVE_GOOGLE === '1'
const googleApiKey = process.env.VOCABIFY_GOOGLE_API_KEY

test.describe('selection to AI lookup flow on WXT dev extension', () => {
  test.setTimeout(90_000)

  let server: http.Server | undefined
  let pageUrl: string
  let mockCompatibleBaseUrl: string
  let browser: Browser
  let context: BrowserContext

  test.beforeAll(async () => {
    test.skip(runLiveGoogle && !googleApiKey, 'VOCABIFY_GOOGLE_API_KEY is required when VOCABIFY_LIVE_GOOGLE=1')
    const fixture = await startFixtureServer()
    pageUrl = fixture.pageUrl
    mockCompatibleBaseUrl = fixture.mockCompatibleBaseUrl
    browser = await chromium.connectOverCDP(await getBrowserWebSocketUrl(devtoolsUrl))
    context = browser.contexts()[0]
    if (!context) throw new Error(`No browser context found at ${devtoolsUrl}. Start WXT with pnpm run dev first.`)
  })

  test.afterAll(async () => {
    if (server) {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server!.close(() => resolve()))
    }
  })

  test('opens selection popover, triggers AI lookup, and enables saving result', async () => {
    const page = await context.newPage()
    try {
      const radixA11yWarnings: string[] = []
      page.on('pageerror', (error) => console.error('pageerror:', error.message))
      page.on('console', (message) => {
        if (isRadixDialogA11yWarning(message.text())) radixA11yWarnings.push(message.text())
        if (['error', 'warning'].includes(message.type())) {
          console.log(`browser ${message.type()}:`, message.text())
        }
      })

      await page.goto(pageUrl)
      await expect(page.locator('#target-paragraph')).toBeVisible()
      await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })

      const extensionId = await getExtensionId(context)
      await seedAiProvider(context, extensionId, {
        apiKey: runLiveGoogle ? googleApiKey! : 'mock-gemini-key',
        liveGoogle: runLiveGoogle,
        baseURL: runLiveGoogle ? undefined : mockCompatibleBaseUrl,
      })

      await selectText(page, 'nuanced phrase')

      const selectionPopover = page.locator('#vocabify-root [data-testid="vocabify-selection-popover"]')
      await expect(selectionPopover).toBeVisible({ timeout: 10_000 })
      await expect(selectionPopover).toHaveAttribute('role', 'toolbar')
      const popoverBox = await selectionPopover.boundingBox()
      expect(popoverBox?.width).toBeLessThanOrEqual(288)
      expect(popoverBox?.height).toBeLessThanOrEqual(100)
      await page.locator('#vocabify-root [data-testid="vocabify-explain-action"]').click()

      await expect(page.locator('#vocabify-root #vocabify-portal-root')).toBeAttached()
      const sheet = page.locator('#vocabify-root [data-testid="vocabify-sheet"]')
      await expect(sheet).toBeVisible({ timeout: 10_000 })
      await expect.poll(async () => {
        const sheetBox = await sheet.boundingBox()
        const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
        if (!sheetBox) return false
        return sheetBox.x > 8
          && sheetBox.y > 8
          && viewport.width - sheetBox.x - sheetBox.width > 8
          && viewport.height - sheetBox.y - sheetBox.height > 8
      }, { timeout: 3_000 }).toBe(true)
      await expect(page.locator('#vocabify-root').getByRole('tab', { name: 'Search' })).toBeVisible()
      await expect(page.locator('#vocabify-root').getByRole('tab', { name: 'My Wordlist' })).toBeVisible()
      await expect(page.locator('#vocabify-root').getByRole('button', { name: 'Open settings' })).toBeVisible()
      await expect(page.locator('#vocabify-root').getByRole('button', { name: 'Close sheet' })).toBeVisible()
      const sheetBox = await sheet.boundingBox()
      const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
      expect(sheetBox).not.toBeNull()
      expect(sheetBox!.height).toBeLessThanOrEqual(Math.round(viewport.height * 0.66))
      await expect(page.locator('#vocabify-root [data-testid="vocabify-ai-panel"]')).toBeVisible()
      expect(radixA11yWarnings).toEqual([])
      await expect(page.locator('#vocabify-root [data-testid="vocabify-ai-result"]')).toContainText(/meaning|usage|example|phrase/i, {
        timeout: 45_000,
      })
      const aiResultScroll = page.locator('#vocabify-root [data-testid="vocabify-ai-result-scroll"]')
      await expect(aiResultScroll).toBeVisible()
      await expect.poll(async () => aiResultScroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      await aiResultScroll.evaluate((node) => {
        node.scrollTop = node.scrollHeight
      })
      await expect.poll(async () => aiResultScroll.evaluate((node) => node.scrollTop > 0)).toBe(true)
      await expect(page.locator('#vocabify-root [data-testid="vocabify-save-action"]')).toBeEnabled()
    } finally {
      await page.close().catch(() => undefined)
    }
  })

  async function startFixtureServer() {
    const fixturePath = path.join(projectRoot, 'tests/fixtures/selection-page.html')
    const html = await fs.readFile(fixturePath)

    server = http.createServer(async (request, response) => {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1')
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        })
        response.end()
        return
      }

      if (
        request.method === 'POST'
        && requestUrl.pathname === '/compatible/v1/chat/completions'
      ) {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })

        const chunks = [
          `data: ${JSON.stringify(createOpenAIChunk('### Meaning\\nA nuanced phrase conveys a subtle or precise expression.\\n\\n'))}\n\n`,
          `data: ${JSON.stringify(createOpenAIChunk(createLongExplanationChunk()))}\n\n`,
          'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1710000000,"model":"mock-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ]

        for (const chunk of chunks) {
          response.write(chunk)
          await new Promise((resolve) => setTimeout(resolve, 40))
        }

        response.end()
        return
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      })
      response.end(html)
    })

    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Unable to start fixture server')
    return {
      pageUrl: `http://127.0.0.1:${address.port}`,
      mockCompatibleBaseUrl: `http://127.0.0.1:${address.port}/compatible/v1`,
    }
  }
})

async function getBrowserWebSocketUrl(baseUrl: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/json/version`)
  if (!response.ok) {
    throw new Error(`Unable to read DevTools metadata from ${baseUrl}: ${response.status} ${response.statusText}`)
  }

  const metadata = await response.json()
  if (!metadata.webSocketDebuggerUrl) {
    throw new Error(`DevTools metadata from ${baseUrl} did not include webSocketDebuggerUrl`)
  }

  return metadata.webSocketDebuggerUrl as string
}

async function seedAiProvider(
  context: BrowserContext,
  extensionId: string,
  config: { apiKey: string; liveGoogle: boolean; baseURL?: string },
) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  await page.evaluate((seedConfig) => {
    const agent = seedConfig.liveGoogle
      ? {
        providerId: 'google',
        providerLabel: 'Google Generative AI',
        apiKey: seedConfig.apiKey,
        model: 'gemini-2.5-flash-lite',
      }
      : {
        providerId: 'custom:mock-compatible',
        providerLabel: 'Mock Compatible',
        apiKey: seedConfig.apiKey,
        model: 'mock-model',
        baseURL: seedConfig.baseURL,
      }

    return chrome.storage.local.set({
      agents: [agent],
      targetLanguage: 'English',
    })
  }, config)
  await page.close()
}

async function getExtensionId(context: BrowserContext) {
  const worker = context.serviceWorkers().find((serviceWorker) => {
    return serviceWorker.url().startsWith('chrome-extension://')
  }) || await context.waitForEvent('serviceworker', {
    predicate: (serviceWorker) => serviceWorker.url().startsWith('chrome-extension://'),
    timeout: 10_000,
  })

  return new URL(worker.url()).host
}

async function selectText(page: Page, text: string) {
  await page.evaluate((selectedText) => {
    const paragraph = document.querySelector('#target-paragraph')
    if (!paragraph) throw new Error('Target paragraph not found')

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const content = node.textContent || ''
      const start = content.indexOf(selectedText)
      if (start >= 0) {
        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, start + selectedText.length)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        const rect = range.getBoundingClientRect()
        paragraph.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }))
        return
      }
      node = walker.nextNode()
    }

    throw new Error(`Unable to find selectable text: ${selectedText}`)
  }, text)
}

function isRadixDialogA11yWarning(text: string) {
  return text.includes('`DialogContent` requires a `DialogTitle`')
    || text.includes('Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.')
}

function createOpenAIChunk(content: string) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 1710000000,
    model: 'mock-model',
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  }
}

function createLongExplanationChunk() {
  const examples = Array.from({ length: 18 }, (_, index) => {
    return `- Example ${index + 1}: A nuanced phrase can carry context, tone, and implication without spelling everything out.`
  }).join('\n')

  return [
    '### Usage',
    '- Usually adjective + noun',
    '- Often used in analytical writing',
    '',
    '### Examples',
    examples,
    '',
    '### Notes',
    'The phrase is useful when the wording matters as much as the literal definition.',
  ].join('\n')
}

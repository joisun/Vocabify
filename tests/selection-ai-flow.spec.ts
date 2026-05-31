import { test, expect, chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const devtoolsUrl = process.env.VOCABIFY_DEVTOOLS_URL || 'http://127.0.0.1:9222'
const runLiveGemini = process.env.VOCABIFY_LIVE_GEMINI === '1'
const geminiApiKey = process.env.VOCABIFY_GEMINI_API_KEY

test.describe('selection to Gemini AI lookup flow on WXT dev extension', () => {
  test.setTimeout(90_000)

  let server: http.Server | undefined
  let pageUrl: string
  let mockGeminiBaseUrl: string
  let browser: Browser
  let context: BrowserContext

  test.beforeAll(async () => {
    test.skip(runLiveGemini && !geminiApiKey, 'VOCABIFY_GEMINI_API_KEY is required when VOCABIFY_LIVE_GEMINI=1')
    const fixture = await startFixtureServer()
    pageUrl = fixture.pageUrl
    mockGeminiBaseUrl = fixture.mockGeminiBaseUrl
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
      page.on('pageerror', (error) => console.error('pageerror:', error.message))
      page.on('console', (message) => {
        if (isKnownShadowDomRadixA11yNoise(message.text())) return
        if (['error', 'warning'].includes(message.type())) {
          console.log(`browser ${message.type()}:`, message.text())
        }
      })

      await page.goto(pageUrl)
      await expect(page.locator('#target-paragraph')).toBeVisible()
      await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })

      const extensionId = await getExtensionId(context)
      await seedGeminiProvider(context, extensionId, {
        apiKey: runLiveGemini ? geminiApiKey! : 'mock-gemini-key',
        baseURL: runLiveGemini ? undefined : mockGeminiBaseUrl,
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
      await expect(page.locator('#vocabify-root [data-testid="vocabify-sheet"]')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('#vocabify-root [data-testid="vocabify-ai-panel"]')).toBeVisible()
      await expect(page.locator('#vocabify-root [data-testid="vocabify-ai-result"]')).toContainText(/meaning|usage|example|phrase/i, {
        timeout: 45_000,
      })
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
        && requestUrl.pathname === '/gemini/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent'
        && requestUrl.searchParams.get('alt') === 'sse'
      ) {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })

        const chunks = [
          'data: {"candidates":[{"content":{"parts":[{"text":"### Meaning\\nA nuanced phrase conveys a subtle or precise expression.\\n\\n"}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":"### Usage\\n- Usually adjective + noun\\n- Often used in analytical writing\\n\\n### Examples\\n- Her nuanced phrase changed the tone.\\n- The report used a nuanced phrase to avoid overstatement."}]}}]}\n\n',
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
      mockGeminiBaseUrl: `http://127.0.0.1:${address.port}/gemini`,
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

async function seedGeminiProvider(
  context: BrowserContext,
  extensionId: string,
  config: { apiKey: string; baseURL?: string },
) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  await page.evaluate((seedConfig) => {
    return chrome.storage.local.set({
      agents: [
        {
          providerId: 'gemini',
          providerLabel: 'Google Gemini',
          category: 'first-party',
          protocol: 'gemini-native',
          apiKey: seedConfig.apiKey,
          model: 'gemini-2.5-flash-lite',
          ...(seedConfig.baseURL ? { baseURL: seedConfig.baseURL } : {}),
        },
      ],
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

function isKnownShadowDomRadixA11yNoise(text: string) {
  return text.includes('`DialogContent` requires a `DialogTitle`')
    || text.includes('Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.')
}

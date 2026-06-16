import { test, expect, chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const devtoolsUrl = process.env.VOCABIFY_DEVTOOLS_URL || 'http://127.0.0.1:9222'

test.describe('Vocabify selection + AI flow', () => {
  test.setTimeout(90_000)

  let server: http.Server | undefined
  let pageUrl: string
  let mockBaseUrl: string
  let browser: Browser
  let context: BrowserContext

  test.beforeAll(async () => {
    const fixture = await startFixtureServer()
    pageUrl = fixture.pageUrl
    mockBaseUrl = fixture.mockBaseUrl
    browser = await chromium.connectOverCDP(await getBrowserWsUrl(devtoolsUrl))
    context = browser.contexts()[0]
    if (!context) throw new Error(`No browser context at ${devtoolsUrl}. Run pnpm dev first.`)
  })

  test.afterAll(async () => {
    if (server) {
      server.closeAllConnections?.()
      await new Promise<void>((r) => server!.close(() => r()))
    }
  })

  test('streaming shows incremental updates before final result', async () => {
    const page = await context.newPage()
    try {
      await setupPage(page)

      await selectText(page, 'nuanced phrase')
      await clickQuery(page)

      await expect.poll(() => getPopoverField(page, 'width'), { timeout: 10_000 }).toBeGreaterThan(330)
      const initialWidth = await getPopoverField(page, 'width')

      await expect.poll(() => getPopoverField(page, 'term'), { timeout: 10_000 }).toBe('nuanced phrase')
      await expect.poll(() => getPopoverField(page, 'rawJsonVisible'), { timeout: 5_000 }).toBe(false)
      await expect.poll(() => getPopoverField(page, 'definition'), { timeout: 15_000 }).toContain('subtle expression')
      await expect.poll(() => getPopoverField(page, 'example'), { timeout: 15_000 }).toContain('diplomat')

      await expect.poll(() => getPopoverField(page, 'saveBtnDisabled'), { timeout: 20_000 }).toBe(false)
      await expect.poll(async () => Math.abs(Number(await getPopoverField(page, 'width')) - Number(initialWidth)), { timeout: 5_000 }).toBeLessThanOrEqual(4)
    } finally {
      await page.close().catch(() => undefined)
    }
  })

  test('popover edit mode inputs are focusable and editable', async () => {
    const page = await context.newPage()
    try {
      await setupPage(page)

      await selectText(page, 'nuanced phrase')
      await clickQuery(page)
      await waitForAiComplete(page)

      // Save first
      await clickInShadow(page, '[data-testid="vocabify-save-action"]')
      await page.waitForTimeout(1000)

      // Enter edit mode
      await clickInShadow(page, '[aria-label="Edit"]')
      await page.waitForTimeout(500)

      // Type in an input inside shadow DOM
      const typed = await page.evaluate(() => {
        const root = document.getElementById('vocabify-root')
        const shadow = root?.shadowRoot
        const input = shadow?.querySelector('input') as HTMLInputElement | null
        if (!input) return null
        input.focus()
        input.value = 'test edit'
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return { focused: document.activeElement === root, value: input.value }
      })

      expect(typed?.value).toBe('test edit')
    } finally {
      await page.close().catch(() => undefined)
    }
  })

  test('theme syncs from options to content script', async () => {
    const extensionId = await getExtensionId(context)
    const page = await context.newPage()
    try {
      await page.goto(pageUrl)
      await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })

      // Set dark theme via localStorage (simulating options page change)
      await page.evaluate(() => {
        localStorage.setItem('vocabify-theme', 'dark')
        window.dispatchEvent(new StorageEvent('storage', { key: 'vocabify-theme', newValue: 'dark' }))
      })
      await page.waitForTimeout(300)

      const containerClass = await page.evaluate(() => {
        const root = document.getElementById('vocabify-root')
        const shadow = root?.shadowRoot
        const container = shadow?.querySelector('#vocabify-react-root')?.parentElement
        return container?.className
      })
      expect(containerClass).toContain('dark')

      // Switch to light
      await page.evaluate(() => {
        localStorage.setItem('vocabify-theme', 'light')
        window.dispatchEvent(new StorageEvent('storage', { key: 'vocabify-theme', newValue: 'light' }))
      })
      await page.waitForTimeout(300)

      const lightClass = await page.evaluate(() => {
        const root = document.getElementById('vocabify-root')
        const shadow = root?.shadowRoot
        return shadow?.querySelector('#vocabify-react-root')?.parentElement?.className
      })
      expect(lightClass).toContain('light')
      expect(lightClass).not.toContain('dark')
    } finally {
      await page.close().catch(() => undefined)
    }
  })

  test('options page does not toast saved messages on initial load', async () => {
    const extensionId = await getExtensionId(context)
    const page = await context.newPage()
    try {
      await page.goto(`chrome-extension://${extensionId}/options.html`)
      await page.waitForTimeout(2_000)
      await expect(page.getByText('Prompt template saved')).toHaveCount(0)
      await expect(page.getByText('Highlight style saved')).toHaveCount(0)
    } finally {
      await page.close().catch(() => undefined)
    }
  })

  // ─── Helpers ─────────────────────────────────────────────────────────

  async function setupPage(page: Page) {
    await page.goto(pageUrl)
    await expect(page.locator('#target-paragraph')).toBeVisible()
    await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })
    const extensionId = await getExtensionId(context)
    await seedAiProvider(context, extensionId, mockBaseUrl)
  }

  async function clickQuery(page: Page) {
    await page.evaluate(() => {
      const root = document.getElementById('vocabify-root')
      const shadow = root?.shadowRoot
      const btn = shadow?.querySelector('[data-testid="vocabify-operation-query"]') as HTMLButtonElement
      btn?.click()
    })
  }

  async function clickInShadow(page: Page, selector: string) {
    await page.evaluate((sel) => {
      const root = document.getElementById('vocabify-root')
      const shadow = root?.shadowRoot
      const el = shadow?.querySelector(sel) as HTMLElement
      el?.click()
    }, selector)
  }

  async function waitForAiComplete(page: Page) {
    await expect.poll(() => getPopoverField(page, 'saveBtnDisabled'), { timeout: 25_000 }).toBe(false)
  }

  function getPopoverField(page: Page, field: string) {
    return page.evaluate((f) => {
      const root = document.getElementById('vocabify-root')
      const shadow = root?.shadowRoot
      const popover = shadow?.querySelector('[data-testid="vocabify-selection-popover"]')
      if (!popover) return null
      if (f === 'term') return popover.querySelector('[data-testid="vocabify-stream-term"]')?.textContent?.trim() || null
      if (f === 'definition') return popover.querySelector('[data-testid="vocabify-stream-definition"]')?.textContent?.trim() || null
      if (f === 'example') return popover.querySelector('[data-testid="vocabify-stream-example"]')?.textContent?.trim() || null
      if (f === 'rawJsonVisible') {
        const text = popover.textContent || ''
        return text.includes('"term"') || text.includes('"senses"') || text.includes('{') || text.includes('reasoning_content')
      }
      if (f === 'width') return Math.round(popover.getBoundingClientRect().width)
      if (f === 'saveBtnDisabled') {
        const btn = popover.querySelector('[data-testid="vocabify-save-action"]') as HTMLButtonElement | null
        return btn?.disabled ?? null
      }
      return null
    }, field)
  }

  async function startFixtureServer() {
    const fixturePath = path.join(projectRoot, 'tests/fixtures/selection-page.html')
    const html = await fs.readFile(fixturePath)

    server = http.createServer(async (request, response) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1')

      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' })
        response.end()
        return
      }

      if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })

        const chunks = [
          chunk('{\n  "term": "nuanced phrase",\n  "phonetic": "/njuːˈɑːnst/",\n'),
          chunk('  "pos": "phrase",\n  "senses": [\n    {\n'),
          chunk('      "definition": "A subtle expression conveying detailed meaning",\n'),
          chunk('      "example": "The diplomat used a nuanced phrase",\n'),
          chunk('      "exampleTranslation": "外交官使用了微妙的措辞"\n    }\n  ],\n'),
          chunk('  "mnemonic": "nuance (subtle) + phrase"\n}\n'),
          '{"id":"x","object":"chat.completion.chunk","created":0,"model":"m","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n',
        ]

        await delay(200)
        for (const c of chunks) {
          response.write(`data: ${JSON.stringify(typeof c === 'string' ? JSON.parse(c) : c)}\n\n`)
          await delay(80)
        }
        response.write('data: [DONE]\n\n')
        response.end()
        return
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
      response.end(html)
    })

    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Server start failed')
    return { pageUrl: `http://127.0.0.1:${addr.port}`, mockBaseUrl: `http://127.0.0.1:${addr.port}/v1` }
  }
})

// ─── Shared utilities ──────────────────────────────────────────────────

async function getBrowserWsUrl(baseUrl: string) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/json/version`)
  if (!res.ok) throw new Error(`DevTools unreachable at ${baseUrl}: ${res.status}`)
  const meta = await res.json()
  if (!meta.webSocketDebuggerUrl) throw new Error('No webSocketDebuggerUrl in DevTools response')
  return meta.webSocketDebuggerUrl as string
}

async function seedAiProvider(context: BrowserContext, extensionId: string, baseUrl: string) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  await page.evaluate((url) => {
    return chrome.storage.local.set({
      agents: [{
        providerId: 'custom:mock',
        providerLabel: 'Mock',
        apiKey: 'test-key',
        model: 'mock-model',
        baseURL: url,
      }],
      targetLanguage: 'English',
    })
  }, baseUrl)
  await page.close()
}

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

async function canOpenOptionsPage(context: BrowserContext, extensionId: string) {
  const page = await context.newPage()
  try {
    const response = await page.goto(`chrome-extension://${extensionId}/options.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 2_000,
    })
    return response?.ok() ?? false
  } catch {
    return false
  } finally {
    await page.close().catch(() => undefined)
  }
}

async function selectText(page: Page, text: string) {
  await page.evaluate((t) => {
    const el = document.querySelector('#target-paragraph')
    if (!el) throw new Error('No #target-paragraph')
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const idx = (node.textContent || '').indexOf(t)
      if (idx >= 0) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + t.length)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
        const rect = range.getBoundingClientRect()
        node.parentElement!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }))
        return
      }
      node = walker.nextNode()
    }
    throw new Error(`Text "${t}" not found`)
  }, text)
}

function chunk(content: string) {
  return { id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { content }, finish_reason: null }] }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

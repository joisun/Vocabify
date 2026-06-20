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
  let failingBaseUrl: string
  let browser: Browser
  let context: BrowserContext

  test.beforeAll(async () => {
    const fixture = await startFixtureServer()
    pageUrl = fixture.pageUrl
    mockBaseUrl = fixture.mockBaseUrl
    failingBaseUrl = fixture.failingBaseUrl
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
    let restoreStorage = async () => {}
    try {
      restoreStorage = await setupPage(page)

      await selectText(page, 'nuanced phrase')
      await clickQuery(page)

      await expect.poll(() => getPopoverField(page, 'width'), { timeout: 10_000 }).toBeGreaterThan(330)
      const initialWidth = await getPopoverField(page, 'width')

      await expect.poll(() => getPopoverField(page, 'term'), { timeout: 10_000 }).toBe('nuanced phrase')
      await expect.poll(() => getPopoverField(page, 'rawJsonVisible'), { timeout: 5_000 }).toBe(false)
      await expect.poll(() => getPopoverField(page, 'definition'), { timeout: 15_000 }).toContain('subtle expression')
      await expect.poll(() => getPopoverField(page, 'example'), { timeout: 5_000 }).toBeNull()

      await expect.poll(() => getPopoverField(page, 'saveBtnDisabled'), { timeout: 20_000 }).toBe(false)
      await expect.poll(async () => Math.abs(Number(await getPopoverField(page, 'width')) - Number(initialWidth)), { timeout: 5_000 }).toBeLessThanOrEqual(4)
    } finally {
      await restoreStorage()
      await page.close().catch(() => undefined)
    }
  })

  test('popover edit mode inputs are focusable and editable', async () => {
    const page = await context.newPage()
    let restoreStorage = async () => {}
    try {
      restoreStorage = await setupPage(page)

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
      await restoreStorage()
      await page.close().catch(() => undefined)
    }
  })

  test('saved word hover shows preview and remains open when moving onto it', async () => {
    const page = await context.newPage()
    let restoreStorage = async () => {}
    try {
      restoreStorage = await setupPage(page)

      await selectText(page, 'nuanced phrase')
      await clickQuery(page)
      await waitForAiComplete(page)
      await clickInShadow(page, '[data-testid="vocabify-save-action"]')
      await expect.poll(() => getSavedHighlightRect(page), { timeout: 10_000 }).not.toBeNull()

      const rect = await getSavedHighlightRect(page)
      expect(rect).not.toBeNull()
      await page.mouse.move(rect!.left + rect!.width / 2, rect!.top + rect!.height / 2)

      await expect.poll(() => getShadowField(page, 'savedHoverVisible'), { timeout: 5_000 }).toBe(true)
      await expect.poll(() => getShadowField(page, 'operationBarVisible'), { timeout: 1_000 }).toBe(false)

      const hoverRect = await getShadowField(page, 'savedHoverRect') as { left: number; top: number; width: number; height: number } | null
      expect(hoverRect).not.toBeNull()
      const gapPoint = getPointBetweenRects(rect!, hoverRect!)
      await page.mouse.move(gapPoint.x, gapPoint.y)
      await page.waitForTimeout(420)
      await expect.poll(() => getShadowField(page, 'savedHoverVisible'), { timeout: 1_000 }).toBe(true)

      await page.mouse.move(hoverRect!.left + hoverRect!.width / 2, hoverRect!.top + hoverRect!.height / 2, { steps: 12 })
      await page.waitForTimeout(120)

      await expect.poll(() => getShadowField(page, 'savedHoverVisible'), { timeout: 2_000 }).toBe(true)
      await expect.poll(() => getShadowField(page, 'operationBarVisible'), { timeout: 1_000 }).toBe(false)
      await page.mouse.move(4, 4)
      await expect.poll(() => getShadowField(page, 'savedHoverVisible'), { timeout: 2_000 }).toBe(false)
    } finally {
      await restoreStorage()
      await page.close().catch(() => undefined)
    }
  })

  test('saved word hover works for records that exist before content UI initializes', async () => {
    const page = await context.newPage()
    let restoreStorage = async () => {}
    try {
      restoreStorage = await setupPage(page)
      await seedSavedRecordBeforeReload(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })
      await expect.poll(() => getSavedHighlightRect(page), { timeout: 10_000 }).not.toBeNull()

      const rect = await getSavedHighlightRect(page)
      expect(rect).not.toBeNull()
      await page.mouse.move(rect!.left + rect!.width / 2, rect!.top + rect!.height / 2)

      await expect.poll(() => getShadowField(page, 'savedHoverVisible'), { timeout: 5_000 }).toBe(true)
      await expect.poll(() => getShadowField(page, 'operationBarVisible'), { timeout: 1_000 }).toBe(false)
    } finally {
      await restoreStorage()
      await page.close().catch(() => undefined)
    }
  })

  test('theme syncs from options to content script', async () => {
    const extensionId = await getExtensionId(context)
    const page = await context.newPage()
    try {
      await page.goto(pageUrl)
      await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })

      // Set dark theme via extension storage, matching the options page data path.
      await setExtensionStorage(context, extensionId, { 'vocabify-theme': 'dark' })
      await page.waitForTimeout(300)

      const containerClass = await page.evaluate(() => {
        const root = document.getElementById('vocabify-root')
        const shadow = root?.shadowRoot
        const container = shadow?.querySelector('#vocabify-react-root')?.parentElement
        return container?.className
      })
      expect(containerClass).toContain('dark')
      await expect.poll(() => getShadowField(page, 'portalClass'), { timeout: 3_000 }).toContain('dark')

      await selectText(page, 'nuanced phrase')
      await expect.poll(() => getShadowField(page, 'popoverBackground'), { timeout: 3_000 }).toBe('rgb(42, 42, 45)')

      // Switch to light through the same extension-wide storage key.
      await setExtensionStorage(context, extensionId, { 'vocabify-theme': 'light' })
      await page.waitForTimeout(300)

      const lightClass = await page.evaluate(() => {
        const root = document.getElementById('vocabify-root')
        const shadow = root?.shadowRoot
        return shadow?.querySelector('#vocabify-react-root')?.parentElement?.className
      })
      expect(lightClass).toContain('light')
      expect(lightClass).not.toContain('dark')
      await expect.poll(() => getShadowField(page, 'portalClass'), { timeout: 3_000 }).toContain('light')
      await expect.poll(() => getShadowField(page, 'popoverBackground'), { timeout: 3_000 }).toBe('rgb(255, 255, 255)')
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

  test('failed lookup shows provider error after configured retries', async () => {
    const page = await context.newPage()
    let restoreStorage = async () => {}
    try {
      restoreStorage = await setupPage(page, failingBaseUrl, { aiMaxRetries: 1 })

      await selectText(page, 'nuanced phrase')
      await clickQuery(page)

      await expect.poll(() => getShadowField(page, 'errorText'), { timeout: 20_000 }).toContain('rate limit exceeded')
      await expect.poll(() => getShadowField(page, 'errorText'), { timeout: 1_000 }).toContain('retried 1 time')
    } finally {
      await restoreStorage()
      await page.close().catch(() => undefined)
    }
  })

  test('familiarity marks settle once per local day and allow same-day correction', async () => {
    const page = await context.newPage()
    let restoreStorage = async () => {}
    try {
      restoreStorage = await setupPage(page)
      await seedSavedRecordBeforeReload(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })
      await expect.poll(() => getSavedHighlightRect(page), { timeout: 10_000 }).not.toBeNull()

      const rect = await getSavedHighlightRect(page)
      expect(rect).not.toBeNull()
      await page.mouse.move(rect!.left + rect!.width / 2, rect!.top + rect!.height / 2)
      await expect.poll(() => getShadowField(page, 'savedHoverVisible'), { timeout: 5_000 }).toBe(true)

      await clickInShadow(page, '[data-testid="vocabify-mark-know"]')
      await expect.poll(() => getShadowField(page, 'familiarityScore'), { timeout: 5_000 }).toBe(18)
      await expect.poll(() => getShadowField(page, 'knowPressed'), { timeout: 5_000 }).toBe(true)

      await clickInShadow(page, '[data-testid="vocabify-mark-know"]')
      await expect.poll(() => getShadowField(page, 'familiarityScore'), { timeout: 5_000 }).toBe(18)
      await expect.poll(() => getShadowField(page, 'knowPressed'), { timeout: 5_000 }).toBe(true)

      await clickInShadow(page, '[data-testid="vocabify-mark-forget"]')
      await expect.poll(() => getShadowField(page, 'familiarityScore'), { timeout: 5_000 }).toBe(0)
      await expect.poll(() => getShadowField(page, 'forgetPressed'), { timeout: 5_000 }).toBe(true)
    } finally {
      await restoreStorage()
      await page.close().catch(() => undefined)
    }
  })

  // ─── Helpers ─────────────────────────────────────────────────────────

  async function setupPage(page: Page, baseUrl = mockBaseUrl, extraStorage: Record<string, unknown> = {}) {
    await page.goto(pageUrl)
    const extensionId = await getExtensionId(context)
    await clearPageOriginDatabase(page)
    await clearExtensionDatabase(context, extensionId)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('#target-paragraph')).toBeVisible()
    await expect(page.locator('#vocabify-root')).toBeAttached({ timeout: 15_000 })
    return seedAiProvider(context, extensionId, baseUrl, extraStorage)
  }

  async function clearPageOriginDatabase(page: Page) {
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('VocabifyIndexDB')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    }))
  }

  async function seedSavedRecordBeforeReload(page: Page) {
    const extensionId = await getExtensionId(context)
    await seedExtensionRecord(context, extensionId, page.url())
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

  function getShadowField(page: Page, field: string) {
    return page.evaluate((f) => {
      const root = document.getElementById('vocabify-root')
      const shadow = root?.shadowRoot
      if (!shadow) return null
      if (f === 'savedHoverVisible') return !!shadow.querySelector('[data-testid="vocabify-saved-hover-card"]')
      if (f === 'operationBarVisible') return !!shadow.querySelector('[data-testid="vocabify-operation-query"]')
      if (f === 'retryingVisible') return !!shadow.querySelector('[data-testid="vocabify-stream-retrying"]')
      if (f === 'errorText') return shadow.querySelector('[data-testid="vocabify-stream-error"]')?.textContent?.trim() || null
      if (f === 'familiarityScore') {
        const label = shadow.querySelector('[aria-label^="Familiarity score"]')?.getAttribute('aria-label') || ''
        const match = label.match(/Familiarity score (\d+)/)
        return match ? Number(match[1]) : null
      }
      if (f === 'knowPressed') return shadow.querySelector('[data-testid="vocabify-mark-know"]')?.getAttribute('aria-pressed') === 'true'
      if (f === 'fuzzyPressed') return shadow.querySelector('[data-testid="vocabify-mark-fuzzy"]')?.getAttribute('aria-pressed') === 'true'
      if (f === 'forgetPressed') return shadow.querySelector('[data-testid="vocabify-mark-forget"]')?.getAttribute('aria-pressed') === 'true'
      if (f === 'portalClass') return shadow.querySelector('#vocabify-portal-root')?.className || null
      if (f === 'popoverBackground') {
        const popover = shadow.querySelector('[data-radix-popper-content-wrapper] [data-side]') as HTMLElement | null
        return popover ? getComputedStyle(popover).backgroundColor : null
      }
      if (f === 'savedHoverRect') {
        const el = shadow.querySelector('[data-testid="vocabify-saved-hover-card"]')
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      }
      return null
    }, field)
  }

  function getSavedHighlightRect(page: Page) {
    return page.evaluate(() => {
      const el = document.querySelector('.vocabify-highlight')
      if (el) {
        const rect = el.getBoundingClientRect()
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      }

      const paragraph = document.getElementById('target-paragraph')
      if (!paragraph) return null
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const idx = (node.textContent || '').indexOf('nuanced phrase')
        if (idx >= 0) {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + 'nuanced phrase'.length)
          const rect = range.getBoundingClientRect()
          return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        }
        node = walker.nextNode()
      }
      return null
    })
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
          chunk('```json\n{\n  "term": "nuanced'),
          chunk(' phrase",\n  "phonetic": "/njuːˈɑːnst/",\n'),
          chunk('  "pos": "phrase",\n  "senses": [\n    {\n      "definition": "A subtle'),
          chunk(' expression conveying detailed meaning",\n'),
          chunk('      "example": "The diplomat used'),
          chunk(' a nuanced phrase",\n'),
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

      if (request.method === 'POST' && url.pathname === '/fail/v1/chat/completions') {
        response.writeHead(429, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        response.end(JSON.stringify({ error: { message: 'rate limit exceeded', code: 'rate_limit' } }))
        return
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
      response.end(html)
    })

    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Server start failed')
    return {
      pageUrl: `http://127.0.0.1:${addr.port}`,
      mockBaseUrl: `http://127.0.0.1:${addr.port}/v1`,
      failingBaseUrl: `http://127.0.0.1:${addr.port}/fail/v1`,
    }
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

async function setExtensionStorage(context: BrowserContext, extensionId: string, values: Record<string, unknown>) {
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/options.html`)
    await page.evaluate((nextValues) => chrome.storage.local.set(nextValues), values)
  } finally {
    await page.close().catch(() => undefined)
  }
}

async function clearExtensionDatabase(context: BrowserContext, extensionId: string) {
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/options.html`)
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('VocabifyIndexDB', 70)
      request.onupgradeneeded = () => {
        const db = request.result
        const records = db.objectStoreNames.contains('records')
          ? request.transaction!.objectStore('records')
          : db.createObjectStore('records', { keyPath: 'id', autoIncrement: true })
        for (const indexName of ['wordOrPhrase', 'createdAt', 'updatedAt', 'score']) {
          if (!records.indexNames.contains(indexName)) records.createIndex(indexName, indexName)
        }
        const tombstones = db.objectStoreNames.contains('syncTombstones')
          ? request.transaction!.objectStore('syncTombstones')
          : db.createObjectStore('syncTombstones', { keyPath: 'wordOrPhrase' })
        if (!tombstones.indexNames.contains('deletedAt')) tombstones.createIndex('deletedAt', 'deletedAt')
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const stores = Array.from(db.objectStoreNames).filter((name) => name === 'records' || name === 'syncTombstones')
        if (stores.length === 0) {
          db.close()
          resolve()
          return
        }
        const tx = db.transaction(stores, 'readwrite')
        stores.forEach((storeName) => tx.objectStore(storeName).clear())
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }
    }))
  } finally {
    await page.close().catch(() => undefined)
  }
}

async function seedExtensionRecord(context: BrowserContext, extensionId: string, sourceUrl: string) {
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/options.html`)
    await page.evaluate((url) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('VocabifyIndexDB', 70)
      request.onupgradeneeded = () => {
        const db = request.result
        const records = db.objectStoreNames.contains('records')
          ? request.transaction!.objectStore('records')
          : db.createObjectStore('records', { keyPath: 'id', autoIncrement: true })
        for (const indexName of ['wordOrPhrase', 'createdAt', 'updatedAt', 'score']) {
          if (!records.indexNames.contains(indexName)) records.createIndex(indexName, indexName)
        }
        const tombstones = db.objectStoreNames.contains('syncTombstones')
          ? request.transaction!.objectStore('syncTombstones')
          : db.createObjectStore('syncTombstones', { keyPath: 'wordOrPhrase' })
        if (!tombstones.indexNames.contains('deletedAt')) tombstones.createIndex('deletedAt', 'deletedAt')
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('records', 'readwrite')
        const store = tx.objectStore('records')
        const now = new Date().toISOString()
        store.put({
          id: 1,
          wordOrPhrase: 'nuanced phrase',
          term: 'nuanced phrase',
          phonetic: '/njuːˈɑːnst/',
          pos: 'phrase',
          senses: [{
            id: 's1',
            definition: 'A subtle expression conveying detailed meaning',
            example: 'The diplomat used a nuanced phrase',
            exampleTranslation: '外交官使用了微妙的措辞',
          }],
          mnemonic: 'nuance (subtle) + phrase',
          tags: [],
          sourceUrl: url,
          sourceContext: 'Meticulous readers often pause at a nuanced phrase.',
          createdAt: now,
          updatedAt: now,
          score: 0,
          firstMarkedAt: null,
          lastMarkedAt: null,
          lastDecayAt: null,
          memoryAnchorScore: 0,
          memoryAnchorAt: null,
          memoryHorizonDays: 0,
          memoryCurve: { x1: 0.18, y1: 0.04, x2: 0.82, y2: 1 },
          lastReviewDate: null,
          lastReviewAction: null,
          dailyReviewBaseScore: null,
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }
    }), sourceUrl)
  } finally {
    await page.close().catch(() => undefined)
  }
}

async function seedAiProvider(context: BrowserContext, extensionId: string, baseUrl: string, extraStorage: Record<string, unknown> = {}) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  const previous = await page.evaluate(() => {
    return chrome.storage.local.get(['agents', 'targetLanguage', 'aiMaxRetries', 'translationRevealMode', 'hightlightStyle', 'vocabify-theme'])
  }) as Record<string, unknown>
  await page.evaluate(({ url, extra }) => {
    return chrome.storage.local.set({
      agents: [{
        providerId: 'custom:mock',
        providerLabel: 'Mock',
        apiKey: 'test-key',
        model: 'mock-model',
        baseURL: url,
      }],
      targetLanguage: 'English',
      ...extra,
    })
  }, { url: baseUrl, extra: extraStorage })
  await page.close()

  return async () => {
    const restorePage = await context.newPage()
    try {
      await restorePage.goto(`chrome-extension://${extensionId}/options.html`)
      await restorePage.evaluate((snapshot) => {
        const updates: Record<string, unknown> = {}
        const removals: string[] = []
        for (const key of ['agents', 'targetLanguage', 'aiMaxRetries', 'translationRevealMode', 'hightlightStyle', 'vocabify-theme'] as const) {
          if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
            updates[key] = snapshot[key]
          } else {
            removals.push(key)
          }
        }
        return Promise.all([
          Object.keys(updates).length ? chrome.storage.local.set(updates) : Promise.resolve(),
          removals.length ? chrome.storage.local.remove(removals) : Promise.resolve(),
        ])
      }, previous)
    } finally {
      await restorePage.close().catch(() => undefined)
    }
  }
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

function getPointBetweenRects(
  anchor: { left: number; top: number; width: number; height: number },
  content: { left: number; top: number; width: number; height: number },
) {
  const anchorCenterX = anchor.left + anchor.width / 2
  const anchorCenterY = anchor.top + anchor.height / 2
  const contentCenterX = content.left + content.width / 2
  const contentCenterY = content.top + content.height / 2
  return {
    x: (anchorCenterX + contentCenterX) / 2,
    y: (anchorCenterY + contentCenterY) / 2,
  }
}

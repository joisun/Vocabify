# Playwright E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a professional Playwright testing suite for the Vocabify browser extension and implement the first core E2E tests.

**Architecture:** Use `@playwright/test` with a custom fixture for loading the extension and stable ID detection.

**Tech Stack:** Playwright, TypeScript, WXT.

---

### Task 1: Environment Setup

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Playwright dependencies**
Run: `pnpm add -D @playwright/test`
Expected: Success

- [ ] **Step 2: Install Playwright browsers**
Run: `npx playwright install chromium`
Expected: Success

- [ ] **Step 3: Add test script to package.json**
Modify `package.json`:
```json
"scripts": {
  ...
  "test:e2e": "playwright test"
}
```

### Task 2: Playwright Configuration & Fixture

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/fixtures.ts`

- [ ] **Step 1: Create playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 2: Create extension fixture in tests/fixtures.ts**
```typescript
import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ }, use) => {
    const pathToExtension = path.resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions only work in headful mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // For MV3, we can find the extension ID by looking at the service worker
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent('serviceworker');

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export { expect };
```

### Task 3: Selection Flow Test (TDD)

**Files:**
- Create: `tests/selection.spec.ts`
- Create: `tests/mock-page.html`

- [ ] **Step 1: Create a simple mock page for testing**
Create `tests/mock-page.html`:
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Test Page</h1>
  <p id="target-text">Vocabify is a great tool.</p>
</body>
</html>
```

- [ ] **Step 2: Write the failing test for selection**
Create `tests/selection.spec.ts`:
```typescript
import { test, expect } from './fixtures';
import path from 'path';

test('should show InPageUI when text is selected', async ({ page }) => {
  await page.goto(`file://${path.resolve('tests/mock-page.html')}`);
  
  const target = page.locator('#target-text');
  await target.selectText();

  // Check for the shadow host (adjust selector based on actual implementation)
  const shadowHost = page.locator('vocabify-in-page-ui'); 
  await expect(shadowHost).toBeVisible();
});
```

- [ ] **Step 3: Run the test and verify it fails**
Run: `pnpm test:e2e tests/selection.spec.ts`
Expected: Should fail if the extension isn't loading or the selector is wrong.

- [ ] **Step 4: Refine the test with actual Shadow DOM interaction**
(Update the test with correct selectors discovered during Task 3 Step 3)

### Task 4: Options Page Test

**Files:**
- Create: `tests/options.spec.ts`

- [ ] **Step 1: Write test for Options page**
```typescript
import { test, expect } from './fixtures';

test('should load the options page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page).toHaveTitle(/Vocabify/);
  await expect(page.locator('text=Vocabulary List')).toBeVisible();
});
```

- [ ] **Step 2: Run and verify**
Run: `pnpm test:e2e tests/options.spec.ts`
Expected: Pass

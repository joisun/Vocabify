# Vocabify Playwright Testing Design

## Goal
Establish a robust automated testing suite for the Vocabify browser extension using Playwright. This suite will ensure that core user journeys—selection-based vocabulary capture and management—remain functional throughout development.

## Architecture

### 1. Extension Loading Fixture
We will create a custom Playwright fixture that:
- Locates the built extension in `.output/chrome-mv3`.
- Launches a persistent Chromium context with the `--load-extension` flag.
- Provides a way to retrieve the extension's unique ID for navigating to internal pages (Popup, Options).

### 2. Mocking Strategy
- **AI Service Mock**: Intercept requests to OpenAI/Anthropic/etc. and return predictable JSON responses.
- **WXT Background Communication**: Use Playwright's ability to interact with Service Workers if necessary, though most testing will focus on the UI layers.

### 3. Components to Test
- **In-Page UI (Shadow DOM)**: Verify that selecting text triggers the UI and that the Shadow DOM elements are interactable.
- **Options Page**: Verify that saved words appear in the `VocabList` and that database operations (Dexie) are reflected in the UI.

## Approaches Considered

### Approach 1: Standard Playwright Test Runner (@playwright/test) - **Recommended**
- **Pros**: Built-in reporting, parallel execution, easy integration with GitHub Actions, powerful fixtures.
- **Cons**: Requires installing `@playwright/test` and browsers.
- **Recommendation**: This is the industry standard and provides the best long-term stability.

### Approach 2: Custom Playwright Script
- **Pros**: Minimal overhead, no runner configuration.
- **Cons**: No built-in assertions, reporting, or parallelization.

## Data Flow
1. **User Action**: Select text on a test page.
2. **Detection**: Content script detects selection and shows `InPageUI`.
3. **Interaction**: User clicks "Analyze".
4. **Mocked AI**: Playwright intercepts the network request and returns a mock explanation.
5. **UI Update**: `AIExplanation` component displays the mock data.
6. **Persistence**: User saves the word; background script writes to Dexie.
7. **Verification**: Test navigates to Options page and verifies the word exists.

## Error Handling
- Verification that loading states are shown correctly.
- Verification that network errors (Mocked 500s) are handled gracefully by the UI.

## Testing Strategy
- **Unit Tests**: Existing TypeScript/React logic (can be handled by Vitest separately).
- **E2E Tests**: This Playwright suite.
- **Regression**: Running these tests before every release.

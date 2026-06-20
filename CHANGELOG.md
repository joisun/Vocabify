# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Unified selection popover** replacing the previous TooltipBtn + side Sheet split. Three states (operation-bar / card / edit) share one positioned shell. New-word flow: select → 操作栏 (查询 / 复制) → click 查询 → popover expands inline into a streaming structured card → 加入词库 stores the result. Saved-word flow: hover or select → card renders immediately from storage with familiarity marks + edit / delete in the footer. Inline edit mode lets users tweak any field (term / phonetic / pos / senses / mnemonic) without leaving the page.
- **Saved-word hover preview**: saved vocabulary hover now uses a controlled virtual-anchor popover fed by the highlight service, so CSS Custom Highlight ranges work without fake DOM triggers and the preview stays open while moving from highlighted text onto the card.
- **Configurable AI retry**: failed lookups now retry automatically before surfacing an error. The maximum retry count is stored in Options and defaults to 2.
- **Example translation reveal mode**: example translations can be hidden behind a hover eye control or shown by default from Options.
- **Structured AI response** via `streamText` + JSON-only prompt + tolerant partial-JSON parser. `lib/aiSchema.ts` defines a Zod schema (`term`, `phonetic`, `pos`, `senses[]`, `mnemonic`); `lib/partialJson.ts` scans incomplete JSON field-by-field and keeps a final repair/schema path so each chunk yields a `Partial<VocabResponse>` for structured rendering. Background port emits `partial` / `complete` / `error` instead of exposing raw JSON.
- **Structured `VocabRecord` schema**: `term`, `phonetic`, `pos`, `senses[]` (each `{ definition, example, exampleTranslation, id }`), `mnemonic`, `tags`, `sourceUrl`, `sourceContext`. `saveFromAiResponse` + `updateRecordFields` helpers; `searchRecords` widens to match definitions and display term.
- `useAIStream` hook (`entrypoints/content/useAIStream.ts`) wrapping the Chrome `ai-stream` Port lifecycle.
- **VocabList edit panel**: wordlist edit now switches the area below GitHub sync into a dedicated editor, reusing `RecordEditForm` without embedding the form inside a list row.
- **Unified theme system** (`lib/theme.ts`): extension-wide `chrome.storage.local` key `vocabify-theme` with `light | dark | system` support, shared across options page and content script with storage-change sync.
- **Bézier memory curve**: saved-word dots can now be clicked in the popover or sheet rows to expand a compact memory-curve visualization with anchor/current/projected scores.
- **Daily review settlement**: each word records the local review date, selected action, and daily baseline so repeated Know / Fuzzy / Forget clicks on the same day do not stack score changes.

### Changed
- Options provider settings now use one active provider instead of a fallback chain. The UI was rebuilt as a dense, low-border configuration panel with popular providers (OpenAI, Gemini, Anthropic, DeepSeek), GLM / Kimi OpenAI-compatible presets, and a custom OpenAI-compatible endpoint flow.
- In-page wordlist sheet now opens taller, giving saved vocabulary more vertical reading space.
- In-page wordlist sheet now uses the same theme-aware floating surface tokens as tooltips and selection popovers, with lower-contrast hairline borders.
- Draggable in-page wordlist sheet now exits toward its snapped side when closed, so a sheet moved to the left no longer disappears to the right.
- Highlight appearance settings now support Underline, Background, and Underline + Background modes, 1–4 px underline thickness, and configurable background opacity.
- Saved-word hover previews are now separated from selection-driven lookup popovers. Selection lookup and saved-word preview both use controlled Popover shells, but saved-word hover is driven by highlight hit-testing instead of text selection state.
- Side Sheet (`VocabifySheet` + `InPageUI`) is now Wordlist-only — Tabs and the AI Explain pane have been removed. AI lookup is entirely inline in the selection popover.
- Toolbar icon click now opens the in-page wordlist directly; the browser-action popup entrypoint has been removed.
- `VocabList` rows render the new structured fields: term, phonetic, pos chip, first sense's definition, with expansion revealing all senses, mnemonic, and source link.
- GitHub sync payload bumped to `schemaVersion: 2`. `normalizeRecords` validates the new structured shape and drops legacy `meaning`-only records on import.
- Dexie schema bumped to v7. Vocabulary data is now owned by the extension origin via background messaging; content scripts opportunistically import old page-origin `VocabifyIndexDB` data without deleting it, and records now carry daily-review metadata.
- Familiarity scoring now uses mark-time memory anchors plus a bounded cubic Bézier forgetting curve instead of fixed interval step decay.
- Familiarity marks are now settled once per local day: repeating the same action is a no-op, while switching action on the same day rewrites that day's result from the original daily baseline instead of stacking another delta.
- AI prompting now keeps product behavior, target-language guidance, and the strict JSON output contract in internal system messages, while the user-configured prompt with required `{SELECTION}` / `{LANGUAGE}` placeholders and optional `{SOURCE_CONTEXT}` is sent as the user message.
- Theme provider now uses the extension-wide `vocabify-theme` storage key (previously `vite-ui-theme` in options, separate page-local state in content script).

### Fixed
- **Rough streaming preview**: removed raw chunk / JSON text from the selection popover. Streaming now renders as a field-level structured card while provider reasoning stays hidden.
- **Fine-grained streaming parser**: partial JSON parsing now extracts scalar fields and `senses[]` entries even when a provider cuts chunks inside a string, enabling per-text updates without provider-specific glue code.
- **Selection card title stability**: the lookup card title now stays on the selected text while streaming, uses length-aware two-line truncation with an inline expand control, and no longer shows transient waiting labels.
- **Lookup error visibility**: provider failures now render an explicit error state with the provider message and manual retry action instead of leaving an empty lookup card.
- **Selected phrase integrity**: AI lookup now treats the exact selected text as the vocabulary item, keeps streaming/final `term` aligned with the selection, and marks multi-word selections as `phrase` instead of letting providers replace them with a single context word.
- **Phrase lookup simplification**: multi-word selections now store and display translation only, without phonetic, part-of-speech chip, examples, or mnemonic fields.
- **Selection title expansion**: the selection popover now shows `Show all` only when the title actually overflows the two-line clamp, and expanded titles keep a visible `Show less` control.
- **Familiarity meter display**: saved-word cards and the in-page wordlist now show familiarity as a compact 20-dot meter instead of textual tier labels.
- **Silent familiarity actions**: Know / Fuzzy / Forget now update the score meter directly without showing a toast.
- **Lower-contrast sense cards**: selection popover sense and translation cards now use softer hairline borders in dark mode.
- **Wordlist delete confirmation**: sheet delete actions now sit inline with edit and require a shadcn/Radix AlertDialog confirmation before removing an entry.
- **Wordlist edit overflow**: long edit forms now scroll inside the editor while Cancel / Save stay fixed in the editor footer.
- **Custom highlight style application**: content highlights now read the persisted Options style and repaint when highlight settings change.
- **Highlight style save noise**: changing highlight appearance now saves silently without showing repeated success toasts.
- **Invert highlight text color**: the Options preview and real page highlights now both apply the inverted decoration color.
- **Streaming not incremental**: removed `isPartialEqual` equality gate in `aiService.ts` that suppressed partial updates when only values (not structure) changed.
- **Options provider persistence race**: provider saves now await `chrome.storage.local` completion before updating the active state, and stale model-list requests are ignored after switching providers.
- **Options select scroll lock**: settings page now scrolls inside the app shell, so opening Example translation or other select menus no longer pushes the sticky header and side navigation off-screen.
- **Popover edit inputs unfocusable**: `onMouseDown preventDefault` on the popover container now skips `<input>`, `<textarea>`, and `<select>` elements.
- **Popover invisible in light mode**: selection popover colors now use theme tokens instead of hardcoded white-on-dark classes, so light and dark themes both remain readable.
- **Dark overlay border fatigue**: reduced dark-mode hairline contrast and removed default overlay shadows across options sections, popovers, tooltips, dropdowns, form controls, sheet frame, toast, and the selection popover.
- **Custom provider endpoint handling**: user-defined custom providers follow the same OpenAI-compatible base URL path as GLM and Kimi, using Vercel AI SDK instead of custom SSE glue.
- **Options initial save toasts**: opening the options page no longer triggers "Prompt template saved" or "Highlight style saved" before the user edits anything.
- **Selection popover dismissed on query click**: added `isVocabifyUiEvent` guard to the `mouseup` listener.
- **Saved-word hover flicker**: saved-word hover no longer triggers the text-selection operation popover at the viewport origin, and preview content remains open while the pointer moves from the highlighted word onto the card.
- **AI stream timeout with reasoning models**: increased `chunkMs` from 8s to 30s to accommodate providers that emit `reasoning_content` before `content`.
- **Highlight isolation**: Vocabify now deletes only its own Custom Highlight registry keys, escapes saved terms before regex matching, clears stale fallback `<mark>` nodes before repainting, and skips interactive/code/hidden/extension UI text nodes.
- **Vocabulary import tombstones**: importing data now applies newer tombstones to delete matching local records and prevents older records from reviving entries that were deleted locally.
- **GitHub sync local consistency**: local vocabulary replacement now happens only after `syncdata.json` is successfully written to GitHub, avoiding local mutation when the remote write fails.
- **Popover delete confirmation**: saved-word popover delete actions now use the same shadcn/Radix AlertDialog confirmation pattern as the wordlist sheet.
- **Read-time decay writes**: wordlist/search/highlight reads now materialize Bézier decay without persisting every record, reducing IndexedDB write pressure on large vocabularies.

### Removed
- Multi-provider failover, provider drag-and-drop ordering, and unused provider SDK dependencies for xAI, Groq, Mistral, Cohere, Fireworks, Together.ai, Cerebras, Perplexity, and DeepInfra.
- Hardcoded seeded XunFei/Spark provider credentials; users must explicitly configure their own provider in Options.
- `components/AIExplanation.tsx`, `entrypoints/content/components/TooltipBtn.tsx`, `entrypoints/content/components/TooltipIndicator.tsx` — superseded by `SelectionPopover.tsx`.
- `triggerSelection` message (was an unused no-op).


- Initial implementation of the Vocabify extension.
- Added GitHub synchronization for IndexedDB data.
- Integrated Google TTS API for word pronunciation.
- Implemented automatic synchronization logic.
- Familiarity scoring system: each saved word now carries a 0–100 score with 4 tiers (New / Learning / Familiar / Mastered), each painted with its own highlight color.
- Selection popover for saved words exposes Know / Fuzzy / Forget quick marks with score-band deltas instead of fixed +15 / +5 / −10 changes.
- Lazy passive decay now materializes from `memoryAnchorScore` / `memoryAnchorAt` through a bounded Bézier curve — no background timers required.
- GitHub sync payload now carries score, mark timestamps, and memory-anchor fields so familiarity state survives cross-device syncing; legacy payloads are backfilled with safe defaults.
- Monica-style hover detection on saved highlights: hover any saved word to reveal its mark popover (Know / Fuzzy / Forget) with a 220 ms bridge delay so cursor travel between word and popover never tears the popover down. DOM `<mark>` path uses delegated `mouseover`; CSS Custom Highlight path uses `caretPositionFromPoint` coordinate hit-testing.
- Light / dark / system theme toggle in the options page header. Saved under `vocabify-theme`; the in-page Sheet and options page both subscribe and re-paint on change. Content script also reacts to `prefers-color-scheme` updates.

### Changed
- Improved the expand/collapse animation for records.
- Updated the `NewRecord` and `Editor` components to use the loading state for TTS.
- Highlight rendering groups records by familiarity level so the CSS Custom Highlight API and the `<mark>` fallback share the same 4-color visual language.
- Dexie schema migrations backfill familiarity defaults and memory-anchor fields on existing rows.
- Visual rewrite per CLAUDE.md design system. Replaced the Apple-glass / liquid-glass aesthetic with a Raycast / Linear / Obsidian–style flat surface language: 1 px hairline borders instead of layered shadows, single indigo accent (`#5b5bf8`) reserved for state, dense 8 pt grid spacing, typography-driven hierarchy. Affects `global.css` tokens, all `components/ui/*` primitives (button / input / textarea / select / card / tabs / sheet / sonner / tooltip), the in-page Sheet shell, `TooltipBtn`, `InPageUI`, `VocabList`, `AIExplanation`, and the options page (now a sticky-sidebar settings layout).

### Removed
- `liquid-glass-react` and `@paper-design/shaders-react` dependencies, along with the `MeshGradient` mesh-blob retry button and all `liquid-glass-*` / `shadow-apple-*` / `backdrop-blur-2xl` decorative classes.

### Fixed
- Fixed issues with GitHub API requests and error handling.

## [0.1.0] - 2023-10-01

### Added
- Initial release of the Vocabify extension.

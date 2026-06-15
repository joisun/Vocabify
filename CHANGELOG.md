# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Unified selection popover** replacing the previous TooltipBtn + side Sheet split. Three states (operation-bar / card / edit) share one positioned shell. New-word flow: select → 操作栏 (查询 / 复制 / 更多) → click 查询 → popover expands inline into a streaming structured card → 加入词库 stores the result. Saved-word flow: hover or select → card renders immediately from storage with familiarity marks + edit / delete in the footer. Inline edit mode lets users tweak any field (term / phonetic / pos / senses / mnemonic) without leaving the page.
- **Structured AI response** via `streamText` + JSON-only prompt + tolerant partial-JSON parser. `lib/aiSchema.ts` defines a Zod schema (`term`, `phonetic`, `pos`, `senses[]`, `mnemonic`); `lib/partialJson.ts` repairs unfinished strings/arrays/objects so each chunk yields a `Partial<VocabResponse>` for field-by-field rendering. Background port now emits `partial` / `complete` / `error` instead of raw `chunk`.
- **Structured `VocabRecord` schema**: `term`, `phonetic`, `pos`, `senses[]` (each `{ definition, example, exampleTranslation, id }`), `mnemonic`, `tags`, `sourceUrl`, `sourceContext`. `saveFromAiResponse` + `updateRecordFields` helpers; `searchRecords` widens to match definitions and display term.
- `useAIStream` hook (`entrypoints/content/useAIStream.ts`) wrapping the Chrome `ai-stream` Port lifecycle.
- **VocabList inline edit**: edit button on each expanded record row; shared `RecordEditForm` component reused by both VocabList and SelectionPopover.
- **Unified theme system** (`lib/theme.ts`): single localStorage key `vocabify-theme` with `light | dark | system` support, shared across options page, popup, and content script with cross-tab sync via `StorageEvent`.

### Changed
- Side Sheet (`VocabifySheet` + `InPageUI`) is now Wordlist-only — Tabs and the AI Explain pane have been removed. AI lookup is entirely inline in the selection popover.
- `VocabList` rows render the new structured fields: term, phonetic, pos chip, first sense's definition, with expansion revealing all senses, mnemonic, and source link.
- GitHub sync payload bumped to `schemaVersion: 2`. `normalizeRecords` validates the new structured shape and drops legacy `meaning`-only records on import.
- Dexie schema bumped to v5; the upgrade hook **clears legacy records** (per user direction — small dataset, no migration value).
- Default prompt template rewritten to demand strict JSON output matching the schema; new `{SOURCE_CONTEXT}` placeholder added alongside `{SELECTION}` / `{LANGUAGE}`.
- Theme provider now uses unified `vocabify-theme` key (previously `vite-ui-theme` in options, separate key in content script).

### Fixed
- **Streaming not incremental**: removed `isPartialEqual` equality gate in `aiService.ts` that suppressed partial updates when only values (not structure) changed.
- **Popover edit inputs unfocusable**: `onMouseDown preventDefault` on the popover container now skips `<input>`, `<textarea>`, and `<select>` elements.
- **Popover invisible in light mode**: inner container forces `dark` class (design decision — floating tool palette always uses dark professional theme per CLAUDE.md).
- **Selection popover dismissed on query click**: added `isVocabifyUiEvent` guard to the `mouseup` listener.
- **AI stream timeout with reasoning models**: increased `chunkMs` from 8s to 30s to accommodate providers that emit `reasoning_content` before `content`.

### Removed
- `components/AIExplanation.tsx`, `entrypoints/content/components/TooltipBtn.tsx`, `entrypoints/content/components/TooltipIndicator.tsx` — superseded by `SelectionPopover.tsx`.
- `triggerSelection` message (was an unused no-op).


- Initial implementation of the Vocabify extension.
- Added GitHub synchronization for IndexedDB data.
- Integrated Google TTS API for word pronunciation.
- Implemented automatic synchronization logic.
- Familiarity scoring system: each saved word now carries a 0–100 score with 4 tiers (New / Learning / Familiar / Mastered), each painted with its own highlight color.
- Selection popover for saved words now exposes Know (+15) / Fuzzy (+5) / Forget (−10) quick marks, with a level chip showing the current score.
- Lazy passive decay (Learning −10 / 3d, Familiar −10 / 14d, Mastered −5 / 60d) settled right before each highlight pass — no background timers required.
- GitHub sync payload now carries `score`, `firstMarkedAt`, `lastMarkedAt`, and `lastDecayAt` so familiarity state survives cross-device syncing; legacy payloads are backfilled with safe defaults.
- Monica-style hover detection on saved highlights: hover any saved word to reveal its mark popover (Know / Fuzzy / Forget) with a 220 ms bridge delay so cursor travel between word and popover never tears the popover down. DOM `<mark>` path uses delegated `mouseover`; CSS Custom Highlight path uses `caretPositionFromPoint` coordinate hit-testing.
- Light / dark / system theme toggle in the options page header. Saved to `localStorage` under `vocabify-theme`; the in-page Sheet, popup, and options page all subscribe and re-paint on change. Content script also reacts to `prefers-color-scheme` updates.

### Changed
- Improved the expand/collapse animation for records.
- Updated the `NewRecord` and `Editor` components to use the loading state for TTS.
- Highlight rendering groups records by familiarity level so the CSS Custom Highlight API and the `<mark>` fallback share the same 4-color visual language.
- Dexie schema bumped to v4 with an automatic upgrade that backfills familiarity defaults on existing rows.
- Visual rewrite per CLAUDE.md design system. Replaced the Apple-glass / liquid-glass aesthetic with a Raycast / Linear / Obsidian–style flat surface language: 1 px hairline borders instead of layered shadows, single indigo accent (`#5b5bf8`) reserved for state, dense 8 pt grid spacing, typography-driven hierarchy. Affects `global.css` tokens, all `components/ui/*` primitives (button / input / textarea / select / card / tabs / sheet / sonner / tooltip), the in-page Sheet shell, `TooltipBtn`, `InPageUI`, `VocabList`, `AIExplanation`, popup, and the options page (now a sticky-sidebar settings layout).

### Removed
- `liquid-glass-react` and `@paper-design/shaders-react` dependencies, along with the `MeshGradient` mesh-blob retry button and all `liquid-glass-*` / `shadow-apple-*` / `backdrop-blur-2xl` decorative classes.

### Fixed
- Fixed issues with GitHub API requests and error handling.

## [0.1.0] - 2023-10-01

### Added
- Initial release of the Vocabify extension.

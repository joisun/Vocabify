# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

# Vocabify Product Roadmap

## Current Goal

Upgrade Vocabify from "select text + save words" into a professional learning tool:

- collect vocabulary while reading;
- review with a production-grade spaced repetition model;
- keep data portable through import/export;
- reduce reading noise with per-level highlight visibility;
- keep sync explicit, safe, and observable.

This roadmap is the implementation source of truth for the next work sequence. Implement one phase at a time. Each phase should be independently verifiable and safe to ship.

## Product Principles

- Do not add Chrome permissions unless a phase explicitly requires it.
- Do not break the current selection popover, saved-word hover, or in-page wordlist workflows.
- Keep data migrations reversible or backed up where possible.
- Follow `CLAUDE.md`: dense but calm, low decoration, high scanning efficiency.
- Prefer derived data over new persistent data unless persistence is required for correctness.

---

## Phase 1: Highlight Visibility And Level Styles

Status: Implemented.

### Goal

Give users control over which saved words are highlighted on pages and how each mastery level appears.

### Scope

- Replace the existing `hightlightStyle` preference schema with a v2 structure.
- Add per-level highlight styles for `NEW`, `LEARNING`, `FAMILIAR`, and `MASTERED`.
- Let each level decide whether it appears on reading pages through its own `enabled` flag.
- Do not keep a separate global highlight focus strategy; visibility lives with each level style.
- Keep `MASTERED` words in the wordlist, stats, export, and review system. This phase only controls reading-page highlight noise.

### Implementation Notes

- Store highlight preferences as per-level `levelStyles`.
- Each level style supports:
  - `enabled`
  - `type`
  - `style`
  - `offset`
  - `thickness`
  - `color`
  - `backgroundOpacity`
  - `invertColor`
- `highlightService` must filter records before range generation so disabled levels do not trigger hover hit-testing.
- Options Appearance should expose:
  - New / Learning / Familiar / Mastered tabs;
  - a `Visible Level` multiple-select control for page highlight visibility;
  - direct style controls for the selected level;
  - preview for all four levels.

### Validation

- v2 per-level highlight settings render correctly.
- A disabled level produces no range / mark for matching records.
- Per-level color, opacity, thickness, and decoration apply correctly.
- Changing storage repaints content-script highlights.

Implementation evidence:

- `utils/storage.ts` stores `hightlightStyle` as per-level `levelStyles`.
- `lib/highlightService.ts` filters disabled levels before range generation.
- `entrypoints/options/components/UserInterfaceSettings.tsx` exposes a `Visible Level` multiple-select control plus New / Learning / Familiar / Mastered tabs with direct style editing and previews.
- `tests/selection-ai-flow.spec.ts` covers v2 per-level style painting and disabled-level hover/range filtering.

---

## Phase 2: Dashboard Shell

Status: Implemented.

### Goal

Add an independent Dashboard page as the main learning workspace, without changing current in-page reading workflows.

### Scope

- Add a WXT internal Dashboard page.
- Add Dashboard entry points from popup and options header.
- Keep popup lightweight and keep in-page wordlist as the primary page-level vocabulary panel.
- Do not add permissions.

### Dashboard Sections

- `Wordlist`
- `Review`
- `Header Stats`
- `Memory Curve`
- `Import / Export`
- `Sync`

### Initial Snapshot Data

Dashboard reads through background messaging and extension-origin IndexedDB. Initial snapshot should include:

- total words;
- due / reviewed today;
- level distribution;
- review queue;
- sync status;
- highlight visibility status.

### Validation

- Dashboard opens from popup.
- Dashboard opens from options.
- Empty vocabulary state is readable.
- Non-empty vocabulary state renders overview and queue.
- Generated manifest permissions remain unchanged.

Implementation evidence:

- `entrypoints/dashboard/` adds a WXT internal Dashboard page with a three-column layout: Wordlist, Review, and a right rail for Memory Curve / Import & Export / Sync.
- Dashboard Review uses a centered fixed-height card flow with bidirectional animated transitions, external Reveal / Know / Fuzzy / Forget controls, edit, pronunciation, AI redefinition, full definition display, and lightweight score-based actions before the FSRS phase lands.
- Dashboard Wordlist has Due and lazy-loaded All tabs. Due entries open review mode, All entries open detail mode without review scoring, the All list uses React Virtuoso virtualization, and selected word focus is shared with the card and memory curve panel.
- `lib/dashboard.ts` builds the initial snapshot from extension-origin vocabulary records, highlight visibility settings, and GitHub sync state.
- `vocabDashboardSnapshot` background messaging keeps Dashboard reads behind the background data boundary.
- Popup and Options header both open `dashboard.html` through `chrome.runtime.getURL`.
- No manifest permission changes were added for the Dashboard page.

---

## Phase 3: Import / Export Center

Status: Implemented.

### Goal

Make user data portable and recoverable.

### Export Formats

- JSON export:
  - use the existing full sync payload shape;
  - include schema version;
  - include records and tombstones.
- CSV export:
  - fields: `term`, `phonetic`, `pos`, `definition`, `example`, `exampleTranslation`, `mnemonic`, `score`, `dueAt`, `tags`, `sourceUrl`, `updatedAt`.
- Anki CSV export:
  - fields: `Front`, `Back`, `Tags`;
  - Front: term plus phonetic;
  - Back: definitions, examples, translations, and mnemonic;
  - Tags: Vocabify tags plus part of speech and familiarity level.

### Import

- Support JSON overwrite import.
- Only accept payloads matching the expected schema.
- Run dry-run validation before mutating local data.
- Show schema version, record count, tombstone count, and invalid entry count.
- Before overwrite import, generate a local backup blob.
- Confirmed overwrite import should use the existing replace payload path.

### Validation

- CSV escaping handles commas, quotes, and newlines.
- Anki CSV emits one valid `Front / Back / Tags` row per record.
- Invalid JSON schema is rejected before mutation.
- Overwrite import creates a backup first.

Implementation evidence:

- `lib/vocabPortability.ts` owns JSON schema-v2 validation plus JSON / CSV / Anki CSV serialization.
- Dashboard Import / Export panel downloads full JSON backups, generic CSV, and Anki CSV.
- Dashboard Sync panel exposes a `Sync now` / `Connect` action backed by the existing GitHub Device Flow sync path.
- JSON overwrite import runs dry-run validation before enabling the destructive action.
- Confirmed overwrite import downloads a current local backup before calling the existing `vocabReplace` path.

---

## Phase 4: Professional Review Mode

### Goal

Add an Anki-style review experience using a real spaced repetition algorithm instead of a handcrafted approximation.

### Algorithm

- Use `ts-fsrs`.
- Do not handwrite a near-Anki scheduler.
- Keep existing score-based familiarity as a compatibility and display layer.

### Data Model Additions

Add a review state group to each record:

- `scheduler`
- `dueAt`
- `reviewCount`
- `lapseCount`
- `lastReviewedAt`
- `fsrsCard`
- `reviewLogs`

### Review Flow

- Show one card at a time.
- Before reveal: show term.
- After reveal: show definition, example, translation, mnemonic, and source if available.
- Ratings:
  - `Again`
  - `Hard`
  - `Good`
  - `Easy`

### Compatibility Mapping

- `Again` maps to existing `FORGET`.
- `Hard` maps to existing `FUZZY`.
- `Good` maps to existing `KNOW`.
- `Easy` maps to existing `KNOW`, while preserving FSRS Easy rating internally.

### Migration

- Existing records without FSRS state should initialize from `createdAt`, `updatedAt`, `score`, and `lastReviewDate`.
- Do not delete existing Bezier / score fields.

### Validation

- First review creates FSRS state.
- Consecutive Good reviews move due date forward.
- Again review increments lapse state and shortens interval.
- Daily review settlement does not double-count existing score behavior.

---

## Phase 5: Ebbinghaus / Retention Curve And Stats

### Goal

Show actionable memory health, not vanity analytics.

### Retention Curve

- Dashboard may surface the current memory curve early; Phase 5 should replace or validate it with a production-grade FSRS / Ebbinghaus retention model.
- Use FSRS stability to derive retention curves.
- Show:
  - current retention;
  - target retention;
  - next due;
  - 7 / 30 / 90 day projection.

### Stats Modules

- Today Load: due, overdue, reviewed, remaining.
- Retention Health: retention buckets such as `<60%`, `60-80%`, `80%+`.
- Level Distribution: New / Learning / Familiar / Mastered.
- Review Quality: recent `Again / Hard / Good / Easy` distribution.
- Learning Velocity: added words, completed reviews, net mastery movement.
- Overdue Debt: overdue count and max overdue days.
- Weak Words: low retention, high lapse, frequent Again.
- Source Insights: group words by `sourceUrl` hostname.
- Data Health: missing definitions, no examples, duplicates, suspiciously long phrases, import anomalies.
- Sync Health: last sync, account, estimated unsynced changes, recent sync error.

### Validation

- Empty stats render cleanly.
- Overdue stats are correct.
- Weak words sort correctly.
- Source hostnames are grouped correctly.

---

## Phase 6: Sync Center And Active Sync

### Goal

Make sync visible and safe first, then optional automation.

### Manual Sync

- Dashboard shows GitHub connection status.
- Dashboard exposes `Sync now`.
- Dashboard shows last sync time, record count, tombstone count, and latest error.

### Active Sync

Implement after manual sync is stable:

- user can enable / disable active sync;
- save / delete / mark events enqueue sync;
- debounce changes for 30-60 seconds;
- only sync when GitHub is connected;
- sync errors appear in Dashboard Sync Health;
- local data must not be replaced unless remote write succeeds.

### Validation

- Connected and disconnected states render correctly.
- Debounce prevents repeated sync calls.
- Failed sync does not mutate local data incorrectly.
- No new permissions are introduced.

---

## Implementation Order

1. Phase 1: Highlight Visibility And Level Styles.
2. Phase 2: Dashboard Shell.
3. Phase 3: Import / Export Center.
4. Phase 4: Professional Review Mode.
5. Phase 5: Ebbinghaus / Retention Curve And Stats.
6. Phase 6: Sync Center And Active Sync.

Phase 1 is intentionally independent of Dashboard and FSRS. It can ship first using the current score-to-level model. Later phases should enhance the behavior without breaking the Phase 1 settings schema.

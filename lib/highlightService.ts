import type { VocabRecord } from '@/lib/vocabTypes'
import { getLevel, levelClassSuffix, type FamiliarityLevel } from '@/lib/familiarity'
import { hightlightStyle, type highlightStyleSettingsType } from '@/utils/storage'
import { getAllRecords } from '@/lib/vocabApi'
import { NO_SELECTION_CONTAINER } from '@/const'

const LEVELS: FamiliarityLevel[] = ['NEW', 'LEARNING', 'FAMILIAR', 'MASTERED']

const VOCABIFY_HIGHLIGHT_STYLE_ID = 'vocabify-highlight-styles'
const VOCABIFY_HIGHLIGHT_PREFIX = 'vocabify-'
const FALLBACK_HIGHLIGHT_SELECTOR = '.vocabify-highlight'
const SKIP_TEXT_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'BUTTON',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
])
const SKIP_TEXT_SELECTOR = Array.from(SKIP_TEXT_TAGS).join(',')

/**
 * Stylesheet appended to the host document. Mirrors the rules in
 * `assets/global.css` so the in-page highlights paint correctly even though
 * the rest of the extension UI lives in a Shadow DOM.
 */
const LEVEL_FALLBACK_COLORS: Record<FamiliarityLevel, { r: number; g: number; b: number; a: number }> = {
  NEW: { r: 34, g: 197, b: 94, a: 0.18 },
  LEARNING: { r: 249, g: 115, b: 22, a: 0.22 },
  FAMILIAR: { r: 59, g: 130, b: 246, a: 0.18 },
  MASTERED: { r: 168, g: 85, b: 247, a: 0.10 },
}

export type HoverRect = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export type HoverEvent = {
  recordId: number
  word: string
  score: number
  level: FamiliarityLevel
  rect: HoverRect
}

export type HoverListener = (event: HoverEvent | null) => void

/**
 * Paints saved vocabulary on the page, colored by familiarity level.
 *
 * Two render strategies share one semantic:
 *   - CSS Custom Highlight API (modern Chromium / Safari)  →  ::highlight(vocabify-<level>)
 *   - <mark class="vocabify-highlight vocabify-level-<level>"> (everything else)
 *
 * Both feed the saved-word hover detector. DOM marks bind delegated mouseover;
 * the CSS Highlight path has no DOM trigger, so it uses coordinate hit-testing.
 * Decay is settled lazily right before each pass so colors always reflect the
 * up-to-date score, no background timer required.
 */
export class HighlightService {
  private highlights: Map<string, Highlight> = new Map()
  private supportsCustomHighlight: boolean = false
  private styleElement: HTMLStyleElement | null = null

  // Hover detection state
  private records: VocabRecord[] = []
  private rangesByRecordId: Map<number, Range[]> = new Map()
  private hoverListener: HoverListener | null = null
  private hoverHandlersInstalled = false
  private currentHoverId: number | null = null
  private pointerX = 0
  private pointerY = 0
  private mousemoveScheduled = false

  constructor() {
    this.supportsCustomHighlight = 'highlights' in CSS && CSS.highlights instanceof HighlightRegistry
  }

  async highlightVocabulary() {
    await this.ensureStylesInjected()
    const records = await getAllRecords()
    this.records = records
    this.rangesByRecordId.clear()

    if (this.supportsCustomHighlight) {
      this.highlightWithCustomAPI(records)
    } else {
      this.highlightWithFallback(records)
    }
  }

  /**
   * Subscribe to hover hits on saved words. The listener fires:
   *   - with a HoverEvent when the cursor enters a saved highlight
   *   - with null when the cursor leaves the current highlight
   *
   * Bridge-delay between leaving the highlight and hiding the popover is
   * the consumer's responsibility (so it can also keep the popover open
   * while the cursor is over the popover itself).
   */
  setHoverListener(listener: HoverListener | null) {
    this.hoverListener = listener
    if (listener) this.installHoverHandlers()
  }

  /**
   * Inject highlight color rules into the host document.
   *
   * The content script bundles `assets/global.css` into the Shadow DOM (cssInjectionMode: 'ui'),
   * but the marks we paint live on the host document and can't see those styles. The CSS Custom
   * Highlight API also needs `::highlight(...)` selectors registered on the host stylesheet.
   */
  private async ensureStylesInjected() {
    if (typeof document === 'undefined') return

    const style = this.styleElement || document.getElementById(VOCABIFY_HIGHLIGHT_STYLE_ID) as HTMLStyleElement | null
    this.styleElement = style || document.createElement('style')
    this.styleElement.id = VOCABIFY_HIGHLIGHT_STYLE_ID
    this.styleElement.textContent = buildHighlightStyles(await hightlightStyle.getValue())
    if (!this.styleElement.isConnected) {
      document.head.appendChild(this.styleElement)
    }
  }

  private highlightWithCustomAPI(records: VocabRecord[]) {
    this.clearCustomHighlights()
    this.highlights.clear()

    const textNodes = this.getAllTextNodes(document.body)
    const rangesByLevel = new Map<FamiliarityLevel, Range[]>()
    LEVELS.forEach((level) => rangesByLevel.set(level, []))

    records.forEach((record) => {
      if (record.id == null) return
      const ranges = collectRanges(textNodes, record.wordOrPhrase)
      if (ranges.length === 0) return
      const bucket = rangesByLevel.get(getLevel(record.score))
      if (bucket) bucket.push(...ranges)
      // Remember per-record ranges so coordinate-based hover can hit-test.
      this.rangesByRecordId.set(record.id, ranges)
    })

    rangesByLevel.forEach((ranges, level) => {
      if (ranges.length === 0) return
      const highlight = new Highlight(...ranges)
      const name = getCustomHighlightName(level)
      CSS.highlights.set(name, highlight)
      this.highlights.set(name, highlight)
    })
  }

  private highlightWithFallback(records: VocabRecord[]) {
    this.clearFallbackHighlights()
    const textNodes = this.getAllTextNodes(document.body)

    records.forEach((record) => {
      const wordOrPhrase = record.wordOrPhrase
      const regex = createTermRegex(wordOrPhrase)
      const levelSuffix = levelClassSuffix(getLevel(record.score))
      const levelClass = `vocabify-level-${levelSuffix}`

      textNodes.forEach((node) => {
        const text = node.textContent || ''
        const matches = [...text.matchAll(regex)]
        if (matches.length === 0) return

        matches.reverse().forEach((match) => {
          const range = document.createRange()
          range.setStart(node, match.index!)
          range.setEnd(node, match.index! + match[0].length)

          const mark = document.createElement('mark')
          mark.className = `vocabify-highlight ${levelClass}`
          mark.dataset.vocabId = String(record.id)
          mark.dataset.vocabLevel = levelSuffix
          range.surroundContents(mark)
        })
      })
    })
  }

  private getAllTextNodes(root: Node): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          if (shouldSkipVocabifyTextParent(parent)) {
            return NodeFilter.FILTER_REJECT
          }
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    let node: Node | null
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text)
    }

    return textNodes
  }

  clearHighlights() {
    if (this.supportsCustomHighlight) {
      this.clearCustomHighlights()
      this.highlights.clear()
    } else {
      this.clearFallbackHighlights()
    }
    this.rangesByRecordId.clear()
    this.records = []
    this.dispatchHoverEnd()
  }

  private clearCustomHighlights() {
    this.highlights.forEach((_highlight, name) => {
      CSS.highlights.delete(name)
    })
    LEVELS.forEach((level) => {
      CSS.highlights.delete(getCustomHighlightName(level))
    })
  }

  private clearFallbackHighlights() {
    document.querySelectorAll(FALLBACK_HIGHLIGHT_SELECTOR).forEach((el) => {
      const parent = el.parentNode
      if (!parent) return
      parent.replaceChild(document.createTextNode(el.textContent || ''), el)
      parent.normalize()
    })
  }

  observeChanges(callback: () => void) {
    const observer = new MutationObserver((mutations) => {
      const hasSignificantChange = mutations.some(m =>
        m.type === 'childList' && m.addedNodes.length > 0
      )
      if (hasSignificantChange) {
        callback()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return observer
  }

  // ── Hover detection ─────────────────────────────────────────────────────

  private installHoverHandlers() {
    if (this.hoverHandlersInstalled) return
    if (typeof document === 'undefined') return
    this.hoverHandlersInstalled = true

    // DOM (<mark>) path: delegated mouseover / mouseout
    document.addEventListener('mouseover', this.handleMouseOver, true)
    document.addEventListener('mouseout', this.handleMouseOut, true)

    // CSS Custom Highlight path: throttled mousemove for coordinate hit-testing
    if (this.supportsCustomHighlight) {
      document.addEventListener('mousemove', this.handleMouseMove, { passive: true })
    }
  }

  private handleMouseOver = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const mark = target.closest('.vocabify-highlight') as HTMLElement | null
    if (!mark) return
    const id = Number(mark.dataset.vocabId)
    if (!Number.isFinite(id)) return
    this.dispatchHoverForRecord(id, mark.getBoundingClientRect())
  }

  private handleMouseOut = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const mark = target.closest('.vocabify-highlight')
    if (!mark) return
    const related = event.relatedTarget
    // moving within the same mark or into a child — ignore
    if (related instanceof Node && mark.contains(related)) return
    this.dispatchHoverEnd()
  }

  private handleMouseMove = (event: MouseEvent) => {
    this.pointerX = event.clientX
    this.pointerY = event.clientY
    if (this.mousemoveScheduled) return
    this.mousemoveScheduled = true
    requestAnimationFrame(() => {
      this.mousemoveScheduled = false
      this.processCoordinateHover(this.pointerX, this.pointerY)
    })
  }

  private processCoordinateHover(x: number, y: number) {
    if (this.rangesByRecordId.size === 0) {
      if (this.currentHoverId != null) this.dispatchHoverEnd()
      return
    }

    const caret = getCaretPosition(x, y)
    if (!caret) {
      if (this.currentHoverId != null) this.dispatchHoverEnd()
      return
    }

    let hitId: number | null = null
    let hitRect: DOMRect | null = null
    for (const [id, ranges] of this.rangesByRecordId.entries()) {
      for (const range of ranges) {
        if (rangeContainsPoint(range, caret.node, caret.offset)) {
          hitId = id
          hitRect = range.getBoundingClientRect()
          break
        }
      }
      if (hitId != null) break
    }

    if (hitId == null) {
      if (this.currentHoverId != null) this.dispatchHoverEnd()
      return
    }
    if (hitId === this.currentHoverId) return
    this.dispatchHoverForRecord(hitId, hitRect!)
  }

  private dispatchHoverForRecord(id: number, rect: DOMRect) {
    if (this.currentHoverId === id) return
    const record = this.records.find((r) => r.id === id)
    if (!record || record.id == null) return
    this.currentHoverId = id
    this.hoverListener?.({
      recordId: record.id,
      word: record.wordOrPhrase,
      score: record.score,
      level: getLevel(record.score),
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  private dispatchHoverEnd() {
    if (this.currentHoverId == null) return
    this.currentHoverId = null
    this.hoverListener?.(null)
  }
}

function collectRanges(textNodes: Text[], wordOrPhrase: string): Range[] {
  const ranges: Range[] = []
  const regex = createTermRegex(wordOrPhrase)

  textNodes.forEach((node) => {
    const text = node.textContent || ''
    const matches = [...text.matchAll(regex)]
    matches.forEach((match) => {
      const range = document.createRange()
      range.setStart(node, match.index!)
      range.setEnd(node, match.index! + match[0].length)
      ranges.push(range)
    })
  })

  return ranges
}

function getCustomHighlightName(level: FamiliarityLevel) {
  return `${VOCABIFY_HIGHLIGHT_PREFIX}${levelClassSuffix(level)}`
}

function createTermRegex(term: string) {
  const escaped = escapeRegExp(term)
  const pattern = /^[a-zA-Z]+$/.test(term) ? `\\b${escaped}\\b` : escaped
  return new RegExp(pattern, 'gi')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function shouldSkipVocabifyTextParent(parent: HTMLElement) {
  if (parent.closest(SKIP_TEXT_SELECTOR)) return true
  if (parent.isContentEditable) return true
  if (parent.closest(FALLBACK_HIGHLIGHT_SELECTOR)) return true
  if (parent.closest(`.${NO_SELECTION_CONTAINER}`)) return true
  if (parent.closest('#vocabify-root')) return true
  if (parent.closest('[contenteditable="true"]')) return true
  if (parent.closest('[aria-hidden="true"]')) return true
  if (parent.closest('[hidden]')) return true

  const style = window.getComputedStyle(parent)
  return style.display === 'none'
    || style.visibility === 'hidden'
    || style.opacity === '0'
}

/**
 * Cross-browser caret-from-point. Returns the text node + offset under the
 * pointer, used for hit-testing CSS Custom Highlight ranges.
 */
function getCaretPosition(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos?.offsetNode) return { node: pos.offsetNode, offset: pos.offset }
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    if (range?.startContainer) return { node: range.startContainer, offset: range.startOffset }
  }
  return null
}

function rangeContainsPoint(range: Range, node: Node, offset: number): boolean {
  const probe = document.createRange()
  try {
    probe.setStart(node, offset)
    probe.setEnd(node, offset)
    const startCmp = range.compareBoundaryPoints(Range.START_TO_START, probe)
    const endCmp = range.compareBoundaryPoints(Range.END_TO_END, probe)
    return startCmp <= 0 && endCmp >= 0
  } catch {
    return false
  }
}

function buildHighlightStyles(settings: highlightStyleSettingsType) {
  const normalized = normalizeHighlightSettings(settings)
  return LEVELS.map((level) => {
    const suffix = levelClassSuffix(level)
    const color = normalized.useCustomColor ? normalized.color : LEVEL_FALLBACK_COLORS[level]
    const decorationColor = rgba(color, color.a)
    const backgroundColor = rgba(color, normalized.backgroundOpacity)
    const textColor = normalized.invertColor ? rgb(invertRgb(color)) : 'inherit'
    const declarations = [
      `color: ${textColor}`,
      normalized.hasBackground ? `background-color: ${backgroundColor}` : 'background-color: transparent',
      normalized.hasUnderline ? `text-decoration-line: underline` : 'text-decoration-line: none',
      normalized.hasUnderline ? `text-decoration-color: ${decorationColor}` : '',
      normalized.hasUnderline ? `text-decoration-style: ${normalized.style}` : '',
      normalized.hasUnderline ? `text-decoration-thickness: ${normalized.thickness}px` : '',
      normalized.hasUnderline ? `text-underline-offset: ${normalized.offset}px` : '',
    ].filter(Boolean).join(';\n  ')

    return `::highlight(${getCustomHighlightName(level)}),
.vocabify-highlight.vocabify-level-${suffix} {
  ${declarations};
}
`
  }).join('\n') + `
.vocabify-highlight {
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 160ms ease;
}
`
}

function normalizeHighlightSettings(settings: highlightStyleSettingsType) {
  const type = settings.type === 'under-over' ? 'underline' : settings.type
  const hasUnderline = type === 'underline' || type === 'underline-background'
  const hasBackground = type === 'background' || type === 'underline-background'
  return {
    hasUnderline,
    hasBackground,
    style: settings.style || 'solid',
    thickness: ['1', '2', '3', '4'].includes(settings.thickness) ? settings.thickness : '2',
    offset: settings.offset || '1',
    color: settings.color,
    backgroundOpacity: Number(settings.backgroundOpacity || settings.color.a || 0.18),
    invertColor: !!settings.invertColor,
    useCustomColor: true,
  }
}

function rgba(color: { r: number; g: number; b: number; a: number }, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function rgb(color: { r: number; g: number; b: number }) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function invertRgb(color: { r: number; g: number; b: number }) {
  return {
    r: 255 - color.r,
    g: 255 - color.g,
    b: 255 - color.b,
  }
}

export const highlightService = new HighlightService()

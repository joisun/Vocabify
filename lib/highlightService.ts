import { db } from '@/lib/vocabifyDb'

export class HighlightService {
  private highlights: Map<string, Highlight> = new Map()
  private supportsCustomHighlight: boolean = false

  constructor() {
    // Feature detection
    this.supportsCustomHighlight = 'highlights' in CSS && CSS.highlights instanceof HighlightRegistry
  }

  async highlightVocabulary() {
    const records = await db.records.toArray()

    if (this.supportsCustomHighlight) {
      this.highlightWithCustomAPI(records)
    } else {
      this.highlightWithFallback(records)
    }
  }

  private highlightWithCustomAPI(records: any[]) {
    // Clear existing highlights
    CSS.highlights.clear()
    this.highlights.clear()

    // Get all text nodes
    const textNodes = this.getAllTextNodes(document.body)

    records.forEach((record) => {
      const ranges: Range[] = []
      const wordOrPhrase = record.wordOrPhrase
      const isWholeWord = /^[a-zA-Z]+$/.test(wordOrPhrase)
      const pattern = isWholeWord ? `\\b${wordOrPhrase}\\b` : wordOrPhrase
      const regex = new RegExp(pattern, 'gi')

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

      if (ranges.length > 0) {
        const highlight = new Highlight(...ranges)
        const highlightName = `vocab-${record.id}`
        CSS.highlights.set(highlightName, highlight)
        this.highlights.set(highlightName, highlight)
      }
    })
  }

  private highlightWithFallback(records: any[]) {
    // Fallback: wrap text in <mark> elements
    const textNodes = this.getAllTextNodes(document.body)

    records.forEach((record) => {
      const wordOrPhrase = record.wordOrPhrase
      const isWholeWord = /^[a-zA-Z]+$/.test(wordOrPhrase)
      const pattern = isWholeWord ? `\\b${wordOrPhrase}\\b` : wordOrPhrase
      const regex = new RegExp(pattern, 'gi')

      textNodes.forEach((node) => {
        const text = node.textContent || ''
        const matches = [...text.matchAll(regex)]

        if (matches.length === 0) return

        // Process matches in reverse order to maintain indices
        matches.reverse().forEach((match) => {
          const range = document.createRange()
          range.setStart(node, match.index!)
          range.setEnd(node, match.index! + match[0].length)

          const mark = document.createElement('mark')
          mark.className = 'vocabify-highlight'
          mark.dataset.vocabId = String(record.id)
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
          // Skip script, style, and already highlighted elements
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT
          }
          if (parent.classList.contains('vocabify-highlight')) {
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
      CSS.highlights.clear()
      this.highlights.clear()
    } else {
      // Remove all <mark> elements
      document.querySelectorAll('.vocabify-highlight').forEach(el => {
        const parent = el.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        }
      })
    }
  }

  // Watch for DOM changes (SPA navigation)
  observeChanges(callback: () => void) {
    const observer = new MutationObserver((mutations) => {
      // Debounce: only trigger if significant changes
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
}

export const highlightService = new HighlightService()

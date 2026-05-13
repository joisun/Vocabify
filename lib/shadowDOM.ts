import { createRoot, type Root } from 'react-dom/client'
import contentStyles from './content.css?inline'

export class ShadowDOMContainer {
  private shadowHost: HTMLDivElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private reactRoot: Root | null = null

  mount() {
    if (this.shadowHost) return

    // Create shadow host
    this.shadowHost = document.createElement('div')
    this.shadowHost.id = 'vocabify-root'
    document.body.appendChild(this.shadowHost)

    // Attach shadow root
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' })

    // Inject styles
    const styleSheet = new CSSStyleSheet()
    styleSheet.replaceSync(contentStyles)
    this.shadowRoot.adoptedStyleSheets = [styleSheet]

    // Create React container inside shadow root
    const reactContainer = document.createElement('div')
    reactContainer.id = 'vocabify-app'
    this.shadowRoot.appendChild(reactContainer)

    // Create React root
    this.reactRoot = createRoot(reactContainer)
  }

  render(component: React.ReactElement) {
    if (!this.reactRoot) {
      throw new Error('Shadow DOM not mounted. Call mount() first.')
    }
    this.reactRoot.render(component)
  }

  unmount() {
    if (this.reactRoot) {
      this.reactRoot.unmount()
      this.reactRoot = null
    }
    if (this.shadowHost) {
      this.shadowHost.remove()
      this.shadowHost = null
      this.shadowRoot = null
    }
  }

  getShadowRoot(): ShadowRoot | null {
    return this.shadowRoot
  }
}

export const shadowContainer = new ShadowDOMContainer()

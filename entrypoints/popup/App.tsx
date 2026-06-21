import { useCallback, useState } from 'react'
import { ArrowRight, RefreshCw, Settings } from 'lucide-react'
import VocabifySvgIcon from '@/components/custom/VocabifySvgIcon'

type PopupState = 'idle' | 'opening' | 'failed'

function App() {
  const [state, setState] = useState<PopupState>('idle')
  const [message, setMessage] = useState('')

  const openWordlist = useCallback(async () => {
    setState('opening')
    setMessage('Opening your wordlist...')

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        throw new Error('No active tab found.')
      }

      await chrome.tabs.sendMessage(tab.id, { type: 'openVocabList' })
      window.close()
    } catch (error) {
      console.warn('Failed to open Vocabify wordlist from popup:', error)
      setState('failed')
      setMessage('Refresh this page to enable Vocabify, or open a regular webpage.')
    }
  }, [])

  return (
    <main className="w-[288px] overflow-hidden bg-background text-foreground">
      <header className="flex items-center justify-between bg-primary px-3 py-2 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-[8px] bg-white/95">
            <VocabifySvgIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-[17px] font-semibold tracking-[-0.03em]">Vocabify</h1>
          </div>
        </div>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-[7px] text-primary-foreground/88 transition-colors hover:bg-white/12 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
          aria-label="Open settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <section className="space-y-2 px-3 py-3">
        {state === 'failed' ? (
          <p className="text-[12px] leading-5 text-muted-foreground">
            {message}
          </p>
        ) : null}
        {state === 'opening' ? (
          <div className="flex h-10 items-center gap-2 rounded-[7px] bg-secondary px-3 text-[12px] font-medium text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            Opening in-page wordlist
          </div>
        ) : (
          <button
            type="button"
            className="group flex h-10 w-full items-center justify-between rounded-[7px] bg-primary px-3 text-left text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            onClick={() => void openWordlist()}
          >
            <span>{state === 'failed' ? 'Try again' : 'Open Wordlist'}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </section>
    </main>
  )
}

export default App

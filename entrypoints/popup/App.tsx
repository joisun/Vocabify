import { useCallback, useState } from 'react'
import { ArrowRight, BookOpenText, LayoutDashboard, RefreshCw, Settings } from 'lucide-react'
import VocabifySvgIcon from '@/components/custom/VocabifySvgIcon'
import { Button } from '@/components/ui/button'

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

  const openDashboard = useCallback(() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
    window.close()
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
        <div className="space-y-1.5 rounded-[9px] border border-border bg-card p-2 dark:border-white/[0.04]">
          <Button
            type="button"
            variant="outline"
            className="group flex h-10 w-full items-center justify-between rounded-[7px] px-3 text-left text-[13px] font-medium"
            onClick={() => void openWordlist()}
          >
            <span className="inline-flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-primary/10 text-primary">
                {state === 'opening' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookOpenText className="h-3.5 w-3.5" />
                )}
              </span>
              {state === 'failed' ? 'Try again' : 'Open Wordlist'}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="group flex h-10 w-full items-center justify-between rounded-[7px] px-3 text-left text-[13px] font-medium"
            onClick={openDashboard}
          >
            <span className="inline-flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-primary/10 text-primary">
                <LayoutDashboard className="h-3.5 w-3.5" />
              </span>
              Dashboard
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Button>

        </div>
      </section>
    </main>
  )
}

export default App

import { Button } from '@/components/ui/button'
import { BookOpenText, Settings, Sparkles } from 'lucide-react'

function App() {
  function openOptions() {
    chrome.runtime.openOptionsPage()
  }

  function openVocabList() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'openVocabList' })
      }
    })
    window.close()
  }

  return (
    <div className="relative isolate w-[340px] overflow-hidden rounded-[28px] border border-white/24 bg-[linear-gradient(145deg,hsl(var(--surface-glass)/0.38),hsl(var(--surface-glass)/0.18))] p-4 text-foreground shadow-[0_22px_70px_hsl(var(--shadow-color)/0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(145deg,hsl(var(--surface-glass)/0.52),hsl(var(--surface-glass)/0.24))]">
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.60),transparent_34%),radial-gradient(circle_at_88%_12%,hsl(var(--primary)/0.18),transparent_28%)]" />
      <div className="relative flex items-center gap-3 pb-4">
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/24 bg-white/[0.28] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.10]"
        >
          <Sparkles className="h-5 w-5 text-foreground" />
        </div>
        <div className="leading-tight">
          <h1 className="font-display text-[16px] font-semibold tracking-tight">
            Vocabify
          </h1>
          <p className="text-[11px] text-muted-foreground">
            AI vocabulary control center
          </p>
        </div>
      </div>

      <div className="relative space-y-2">
        <Button
          className="liquid-glass-button w-full h-11 rounded-xl text-[14px] justify-start px-4 text-black dark:text-black"
          onClick={openVocabList}
        >
          <BookOpenText className="mr-1 h-4 w-4" />
          Open My Wordlist
        </Button>

        <Button
          variant="outline"
          className="liquid-glass-button w-full h-11 rounded-xl text-[14px] justify-start px-4 text-black dark:text-black"
          onClick={openOptions}
        >
          <Settings className="mr-1 h-4 w-4" />
          Settings
        </Button>

        <p className="pt-2 text-center text-[11px] text-muted-foreground/80">
          Select any text on a page to start learning.
        </p>
      </div>
    </div>
  )
}

export default App

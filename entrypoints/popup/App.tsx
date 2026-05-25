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
    <div className="w-[320px] bg-background text-foreground">
      {/* Apple-style hero header */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(211_100%_60%)] shadow-apple-sm"
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <h1 className="font-display text-[17px] font-semibold tracking-tight">
              Vocabify
            </h1>
            <p className="text-[12px] text-muted-foreground">
              AI-powered vocabulary
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2">
        <Button
          className="w-full h-11 rounded-xl text-[14px] justify-start px-4 shadow-apple-sm"
          onClick={openVocabList}
        >
          <BookOpenText className="mr-1 h-4 w-4" />
          Open Vocabulary List
        </Button>

        <Button
          variant="outline"
          className="w-full h-11 rounded-xl text-[14px] justify-start px-4"
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

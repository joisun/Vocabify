import { Button } from '@/components/ui/button'
import { BookOpenText, Settings } from 'lucide-react'

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
    <div className="w-[300px] bg-background p-3 text-foreground">
      <div className="flex items-center justify-between pb-3">
        <div className="leading-tight">
          <h1 className="font-display text-[14px] font-semibold tracking-tight">Vocabify</h1>
          <p className="text-[11px] text-muted-foreground">Vocabulary workspace</p>
        </div>
      </div>

      <div className="space-y-1">
        <Button
          variant="default"
          size="default"
          className="w-full justify-start rounded-[8px] text-[13px]"
          onClick={openVocabList}
        >
          <BookOpenText className="mr-1.5 h-3.5 w-3.5" />
          Open My Wordlist
        </Button>

        <Button
          variant="outline"
          size="default"
          className="w-full justify-start rounded-[8px] text-[13px]"
          onClick={openOptions}
        >
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Settings
        </Button>
      </div>

      <p className="pt-3 text-[11px] text-muted-foreground">
        Select text on any page to start. Hover saved words to mark how well you remember them.
      </p>
    </div>
  )
}

export default App

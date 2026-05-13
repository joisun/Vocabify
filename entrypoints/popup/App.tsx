import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, BookOpen } from 'lucide-react'

function App() {
  function openOptions() {
    chrome.runtime.openOptionsPage()
  }

  function openVocabList() {
    // Send message to content script to open In-page UI
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'openVocabList' })
      }
    })
    window.close()
  }

  return (
    <div className="w-[320px] p-4">
      <Card>
        <CardHeader>
          <CardTitle>Vocabify</CardTitle>
          <CardDescription>
            Your AI-powered vocabulary learning assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            className="w-full"
            variant="default"
            onClick={openVocabList}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Open Vocabulary List
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={openOptions}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App

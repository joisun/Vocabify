import React, { useState } from 'react'
import { VocabifySheet } from './VocabifySheet'
import { VocabList } from './VocabList'
import { AIExplanation } from './AIExplanation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Settings, X } from 'lucide-react'

interface InPageUIProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedText?: string
}

export function InPageUI({ open, onOpenChange, selectedText }: InPageUIProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'vocab'>('ai')

  // Switch to AI tab when new text is selected
  React.useEffect(() => {
    if (selectedText) {
      setActiveTab('ai')
    }
  }, [selectedText])

  return (
    <VocabifySheet open={open} onOpenChange={onOpenChange}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'ai' | 'vocab')}
        className="flex h-full flex-col"
      >
        <div
          data-vocabify-sheet-drag-handle
          className="flex shrink-0 items-center gap-2 border-b border-white/18 px-4 py-3 dark:border-white/10"
        >
          <TabsList className="grid h-9 flex-1 grid-cols-2 rounded-full bg-white/[0.26] p-0.5 backdrop-blur-xl dark:bg-white/[0.08]">
            <TabsTrigger value="ai">Search</TabsTrigger>
            <TabsTrigger value="vocab">My Wordlist</TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={openSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close sheet"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <TabsContent value="ai" className="flex-1 overflow-hidden mt-0 px-4 pb-4">
          {selectedText ? (
            <AIExplanation selectedText={selectedText} />
          ) : (
            <EmptySelection />
          )}
        </TabsContent>

        <TabsContent value="vocab" className="flex-1 overflow-hidden mt-0 px-4 pb-4">
          <VocabList />
        </TabsContent>
      </Tabs>
    </VocabifySheet>
  )
}

function openSettings() {
  chrome.runtime.openOptionsPage?.()
}

const EmptySelection = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
      </svg>
    </div>
    <p className="text-[14px] font-medium text-foreground">No selection yet</p>
    <p className="max-w-[260px] text-[13px] text-muted-foreground leading-relaxed">
      Highlight any text on the page to ask Vocabify for an instant AI explanation.
    </p>
  </div>
)

import React, { useState } from 'react'
import { VocabifySheet } from './VocabifySheet'
import { VocabList } from './VocabList'
import { AIExplanation } from './AIExplanation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Settings, X } from 'lucide-react'
import { sendMessage } from '@/lib/messaging'

interface InPageUIProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedText?: string
}

export function InPageUI({ open, onOpenChange, selectedText }: InPageUIProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'vocab'>('ai')

  React.useEffect(() => {
    if (selectedText) setActiveTab('ai')
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
          className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5 dark:border-white/8"
        >
          <TabsList className="h-8 flex-1 grid grid-cols-2">
            <TabsTrigger value="ai">Search</TabsTrigger>
            <TabsTrigger value="vocab">My Wordlist</TabsTrigger>
          </TabsList>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void openSettings()}
            aria-label="Open settings"
            title="Settings"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            title="Close"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <TabsContent value="ai" forceMount className="mt-0 flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3">
          {selectedText ? (
            <AIExplanation selectedText={selectedText} />
          ) : (
            <EmptySelection />
          )}
        </TabsContent>

        <TabsContent value="vocab" forceMount className="mt-0 flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3">
          <VocabList />
        </TabsContent>
      </Tabs>
    </VocabifySheet>
  )
}

async function openSettings() {
  try {
    await sendMessage('openOptionsPage', undefined)
  } catch (error) {
    console.warn('openOptionsPage message failed, falling back to direct navigation:', error)
    window.open(chrome.runtime.getURL('options.html'), '_blank', 'noopener,noreferrer')
  }
}

const EmptySelection = () => (
  <div className="flex h-full flex-col items-start justify-center gap-2 px-1">
    <p className="text-[13px] font-medium text-foreground">No selection yet</p>
    <p className="max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
      Highlight any text on the page to ask Vocabify for an instant AI explanation.
      Hover over saved words to mark how well you remember them.
    </p>
  </div>
)

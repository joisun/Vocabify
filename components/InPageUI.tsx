import React, { useState } from 'react'
import { VocabifySheet } from './VocabifySheet'
import { VocabList } from './VocabList'
import { AIExplanation } from './AIExplanation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface InPageUIProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedText?: string
}

export function InPageUI({ open, onOpenChange, selectedText }: InPageUIProps) {
  const [activeTab, setActiveTab] = useState<'vocab' | 'ai'>('vocab')

  // Switch to AI tab when new text is selected
  React.useEffect(() => {
    if (selectedText) {
      setActiveTab('ai')
    }
  }, [selectedText])

  return (
    <VocabifySheet
      open={open}
      onOpenChange={onOpenChange}
      title="Vocabify"
      description="Your AI vocabulary library"
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'vocab' | 'ai')}
        className="flex h-full flex-col"
      >
        <div className="px-6 pt-4 pb-2 shrink-0">
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="vocab">Vocabulary</TabsTrigger>
            <TabsTrigger value="ai">AI Explanation</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="vocab" className="flex-1 overflow-hidden mt-0 px-6 pb-6">
          <VocabList />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden mt-0 px-6 pb-6">
          {selectedText ? (
            <AIExplanation selectedText={selectedText} />
          ) : (
            <EmptySelection />
          )}
        </TabsContent>
      </Tabs>
    </VocabifySheet>
  )
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

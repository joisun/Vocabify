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
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'vocab' | 'ai')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vocab">Vocabulary</TabsTrigger>
          <TabsTrigger value="ai">AI Explanation</TabsTrigger>
        </TabsList>

        <TabsContent value="vocab" className="h-[calc(100vh-200px)]">
          <VocabList />
        </TabsContent>

        <TabsContent value="ai" className="h-[calc(100vh-200px)]">
          {selectedText ? (
            <AIExplanation selectedText={selectedText} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select text on the page to get AI explanation
            </div>
          )}
        </TabsContent>
      </Tabs>
    </VocabifySheet>
  )
}

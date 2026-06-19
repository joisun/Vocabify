import React from 'react'
import { VocabifySheet } from './VocabifySheet'
import { VocabList } from './VocabList'
import { Button } from '@/components/ui/button'
import { Settings, X } from 'lucide-react'
import { sendMessage } from '@/lib/messaging'

interface InPageUIProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InPageUI({ open, onOpenChange }: InPageUIProps) {
  return (
    <VocabifySheet open={open} onOpenChange={onOpenChange}>
      <div className="flex h-full min-h-0 flex-col">
        <div
          data-vocabify-sheet-drag-handle
          className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5 dark:border-white/[0.04]"
        >
          <h2 className="font-display text-[14px] font-semibold tracking-tight">My Wordlist</h2>
          <div className="flex items-center gap-1">
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
        </div>
        <div className="flex min-h-0 w-full flex-1 overflow-hidden px-4 pb-4 pt-3">
          <VocabList />
        </div>
      </div>
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

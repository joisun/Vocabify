import React from 'react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'

interface VocabifySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function VocabifySheet({ open, onOpenChange, children }: VocabifySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0"
        data-testid="vocabify-sheet"
      >
        <div className="sr-only">
          <SheetTitle>Vocabify</SheetTitle>
          <SheetDescription>Your AI vocabulary library</SheetDescription>
        </div>

        <div className="flex-1 overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

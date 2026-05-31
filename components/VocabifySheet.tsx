import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { BookOpenText } from 'lucide-react'

interface VocabifySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}

export function VocabifySheet({ open, onOpenChange, title, description, children }: VocabifySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0"
        data-testid="vocabify-sheet"
      >
        <SheetHeader className="border-b border-white/20 px-6 pb-4 pt-6 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/[0.36] text-primary shadow-apple-xs backdrop-blur-xl dark:border-white/10 dark:bg-white/10"
            >
              <BookOpenText className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <SheetTitle>{title}</SheetTitle>
              {description ? (
                <SheetDescription>{description}</SheetDescription>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

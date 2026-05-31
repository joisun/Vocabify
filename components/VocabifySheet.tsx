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
        className="w-[min(100vw,460px)] sm:max-w-[460px] flex flex-col gap-0 p-0"
        data-testid="vocabify-sheet"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-secondary text-primary shadow-apple-xs shrink-0"
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

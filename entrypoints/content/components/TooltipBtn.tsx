import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Copy, X, Sparkles } from 'lucide-react'
import { copyHandler } from '../utils'
import { NO_SELECTION_CONTAINER } from '@/const'

function TooltipBtn({
  text,
  cancelHandler,
  vocabifyHandler,
}: {
  text: string
  vocabifyHandler: (text: string) => void
  cancelHandler: (text: string) => void
}) {
  return (
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger className={NO_SELECTION_CONTAINER} asChild>
          {/* Subtle Apple-blue underline highlight on the selected text */}
          <span className="bg-gradient-to-b from-transparent from-[70%] via-[hsl(211_100%_50%/0.6)] via-[70%_70%] to-[hsl(211_100%_50%/0.6)]">
            {text}
          </span>
        </TooltipTrigger>

        <TooltipContent
          sideOffset={6}
          className={cn(
            "p-1 rounded-full shadow-apple-lg border border-white/10",
            "bg-foreground/85 backdrop-blur-xl text-background",
            "select-none flex items-center gap-0.5"
          )}
        >
          <button
            type="button"
            onClick={() => vocabifyHandler(text)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-[12px] font-medium",
              "text-background hover:bg-white/15 active:scale-95",
              "transition-[background-color,transform] duration-150 ease-spring"
            )}
            aria-label="Save with Vocabify"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Vocabify
          </button>

          <span className="h-4 w-px bg-white/15" aria-hidden />

          <button
            type="button"
            onClick={() => copyHandler(text)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-[12px] font-medium",
              "text-background hover:bg-white/15 active:scale-95",
              "transition-[background-color,transform] duration-150 ease-spring"
            )}
            aria-label="Copy text"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>

          <span className="h-4 w-px bg-white/15" aria-hidden />

          <button
            type="button"
            onClick={() => cancelHandler(text)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full",
              "text-background/80 hover:bg-destructive hover:text-white active:scale-95",
              "transition-[background-color,color,transform] duration-150 ease-spring"
            )}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Local cn import (avoid cycles in shadow root tree)
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export default TooltipBtn

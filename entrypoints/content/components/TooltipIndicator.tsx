import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NO_SELECTION_CONTAINER } from '@/const'
import { highlightStyleSettingsType } from '@/utils/storage'

function TooltipIndicator({
  text,
  record,
  highlightStyleSettings,
}: {
  text: string
  vocabifyHandler: (text: string) => void
  cancelHandler: (text: string) => void
  record: {
    id: number
    createAt: string
    updateAt: string
    wordOrPhrase: string
    meaning: string
  }
  highlightStyleSettings: highlightStyleSettingsType
}) {
  const handleJump = (wordOrPhrase: string) => {
    ;(window as any).__vocabifyOpenAI?.(wordOrPhrase)
  }

  const typeSet = {
    underline: 'underline',
    'under-over': 'underline overline',
  }

  const { color, invertColor, offset, style, thickness, type } = highlightStyleSettings

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            style={{
              color: invertColor
                ? `rgba(${255 - color.r}, ${255 - color.g}, ${255 - color.b})`
                : undefined,
              textDecorationLine: type !== 'background' ? typeSet[type as keyof typeof typeSet] : undefined,
              textDecorationColor: type !== 'background' ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : undefined,
              textDecorationStyle: type !== 'background' ? (style as any) : undefined,
              textDecorationThickness: type !== 'background' ? `${thickness}px` : undefined,
              textUnderlineOffset: type !== 'background' ? `${offset}px` : undefined,
              backgroundColor: type === 'background' ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : undefined,
              cursor: 'help',
            }}
          >
            {text}
          </span>
        </TooltipTrigger>

        <TooltipContent
          onWheel={(e) => e.stopPropagation()}
          align="start"
          sideOffset={6}
          className="p-0 bg-transparent shadow-none border-0"
        >
          <div
            className={cn(
              NO_SELECTION_CONTAINER,
              'relative w-96 max-h-[calc(100vh-18rem)]',
              'glass border border-border/60 rounded-xl shadow-apple-lg',
              'overflow-hidden animate-spring-in'
            )}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <p className="font-display text-[14px] font-semibold tracking-tight truncate">
                {record.wordOrPhrase}
              </p>
              <Button
                onClick={() => handleJump(record.wordOrPhrase)}
                variant="ghost"
                className="h-7 px-2 text-[12px] text-primary hover:text-primary"
                title="Open full explanation"
              >
                Open
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div
              className={cn(
                'px-4 py-3 prose prose-sm max-w-none dark:prose-invert',
                'prose-p:my-1 prose-strong:text-primary prose-headings:font-display',
                'overflow-auto scrollbar-thin'
              )}
            >
              {record.meaning}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default TooltipIndicator

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CopyIcon, XIcon, Aperture, SquareArrowOutUpRight } from 'lucide-react'
import { copyHandler } from '../utils'
import { marked } from 'marked'
import { cn } from '@/lib/utils'
import { NO_SELECTION_CONTAINER } from '@/const'
import { highlightStyleSettingsType } from '@/utils/storage'
function TooltipIndicator({
  text,
  cancelHandler,
  vocabifyHandler,
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
    chrome.runtime.sendMessage({ action: 'triggerCheck', payload: wordOrPhrase })
  }

  const typeSet = {
    underline: 'underline',
    'under-over': 'underline overline',
  }

  const { color, invertColor, offset, style, thickness, type } = highlightStyleSettings
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="" asChild>
          <span
            className={cn('underline ')}
            style={{
              color: invertColor ? `rgba(${255 - color.r}, ${255 - color.g}, ${255 - color.b})` : undefined,
              textDecorationLine: type !== 'background' ? typeSet[type as keyof typeof typeSet] : undefined,
              textDecorationColor: type !== 'background' ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : undefined,
              textDecorationStyle: type !== 'background' ? (style as any) : undefined,
              textDecorationThickness: type !== 'background' ? `${thickness}px` : undefined,
              textUnderlineOffset: type !== 'background' ? `${offset}px` : undefined,
              backgroundColor: type === 'background' ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` : undefined,
            }}
          >
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent align="start" className="p-0 border-border/50 border rounded-md relative">
          <div
            className={cn(
              NO_SELECTION_CONTAINER,
              'html-wrapper rounded-md bg-background p-2 pt-6 prose prose-sm w-96',
              'dark:prose-invert prose-strong:text-indigo-500',
              'max-h-[calc(100vh-18rem)] overflow-auto scrollbar-thin'
            )}
            dangerouslySetInnerHTML={{ __html: marked.parse(record.meaning) as string }}
          ></div>
          <Button
            onClick={() => handleJump(record.wordOrPhrase)}
            variant="link"
            className="absolute top-0 right-0 p-0 text-indigo-600 hover:text-indigo-500"
            size="icon"
          >
            <SquareArrowOutUpRight />
          </Button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default TooltipIndicator

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CopyIcon, XIcon, Aperture, SquareArrowOutUpRight } from 'lucide-react'
import { copyHandler } from '../utils'
import { marked } from 'marked'
import { cn } from '@/lib/utils'
function TooltipIndicator({
  text,
  cancelHandler,
  vocabifyHandler,
  record,
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
}) {

  const handleJump = (wordOrPhrase: string) => {
    chrome.runtime.sendMessage({ action: 'triggerCheck', payload: wordOrPhrase })
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="" asChild>
          <span className="bg-gradient-to-b from-transparent from-70% via-[percentage:70%_70%] via-indigo-600/80  to-indigo-600/80">{text}</span>
        </TooltipTrigger>
        <TooltipContent align="start" className="p-0 border-border/50 border rounded-md relative">
          <div
            className={cn(
              'html-wrapper rounded-md bg-background p-2 prose w-80',
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

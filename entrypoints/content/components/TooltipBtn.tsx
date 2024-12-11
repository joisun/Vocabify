import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CopyIcon, XIcon, Aperture } from 'lucide-react'
import { copyHandler } from '../utils'
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
        <TooltipTrigger className="" asChild>
          <span>{text}</span>
        </TooltipTrigger>
        <TooltipContent className="flex space-x-1 text-sm rounded-full p-1">
          <Button className="rounded-full h-7 bg-white/20" size={'sm'} variant="ghost" onClick={() => vocabifyHandler(text)}>
            <Aperture />
            Vocabify
          </Button>{' '}
          <Separator orientation="vertical" />
          <Button className="rounded-full h-7 bg-white/20" size={'sm'} variant="ghost" onClick={() => copyHandler(text)}>
            <CopyIcon />
            Copy
          </Button>{' '}
          <Separator orientation="vertical" />
          <Button className="rounded-full h-7 w-7" size={'icon'} variant="destructive" onClick={() => cancelHandler(text)}>
            <XIcon />
          </Button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default TooltipBtn

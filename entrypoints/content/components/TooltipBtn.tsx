import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CopyIcon, XIcon, Aperture } from 'lucide-react'
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
      <Tooltip open >
        <TooltipTrigger className={NO_SELECTION_CONTAINER} asChild>
          <span className='bg-gradient-to-b from-transparent from-70% via-[percentage:70%_70%] via-indigo-600/80  to-indigo-600/80'>{text}</span>
        </TooltipTrigger>
        <TooltipContent className="flex space-x-1 text-sm rounded-full p-1 select-none">
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

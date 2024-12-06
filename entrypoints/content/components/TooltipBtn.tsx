import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator"
import { CopyIcon, XIcon, Aperture } from "lucide-react"
function TooltipBtn({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger className="whitespace-pre">{text}</TooltipTrigger>
        <TooltipContent className="flex space-x-1 text-sm">
          <Button className="bg-white/20" size={"sm"} variant="ghost"><Aperture />Vocabify</Button> <Separator orientation="vertical" />
          <Button className="bg-white/20" size={"sm"} variant="ghost"><CopyIcon />Copy</Button> <Separator orientation="vertical" />
          <Button size={"sm"} variant="destructive"><XIcon /></Button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TooltipBtn;

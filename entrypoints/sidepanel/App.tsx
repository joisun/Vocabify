import { useState } from "react";
import reactLogo from "@/assets/react.svg";
import wxtLogo from "/wxt.svg";
import "./App.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Aperture, CopyIcon, XIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      {/* <div>
        <a href="https://wxt.dev" target="_blank">
          <img src={wxtLogo} className="logo" alt="WXT logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1 className="text-red-300">WXT + React</h1>
      <div className="card">
        <a href="chrome://extensions/" target="_blank">
          chrome://extensions/
        </a>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the WXT and React logos to learn more
      </p> */}

      {/* <Button>Hello wxt + Shadcn</Button> */}

      <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger className="whitespace-pre">Commit</TooltipTrigger>
        <TooltipContent className="flex space-x-1 text-sm">
          <Button className="bg-white/20 px-2" size={"sm"} variant="ghost"><Aperture/>Vocabify</Button> <Separator orientation="vertical"/>
          <Button className="bg-white/20" size={"sm"} variant="ghost"><CopyIcon/>Copy</Button> <Separator orientation="vertical"/>
          <Button size={"sm"} variant="destructive"><XIcon/></Button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    </>
  );
}

export default App;

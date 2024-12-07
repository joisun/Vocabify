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
  const handleClick = function(){
    chrome.runtime.sendMessage({
      action: "saveWord",
      payload: "123",
    });
  }
  return (
    <>
      <Button onClick={handleClick}>Hello wxt + Shadcn</Button>
    </>
  );
}

export default App;

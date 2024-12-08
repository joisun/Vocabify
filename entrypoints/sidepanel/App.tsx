import { useState } from "react";
import reactLogo from "@/assets/react.svg";
import wxtLogo from "/wxt.svg";
// import "./App.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Aperture, CopyIcon, XIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AiApiAdaptor } from "../options/aiModels";
import { chatanywhereAIService } from "../options/aiModels/chatanywhere";
import { xunfeiSparkAPIAIService } from "../options/aiModels/xunfeiSpark";
import { kimiAPIAIService } from "../options/aiModels/kimi";
import preprocessMsg from "./utils/preprocessMsg";
function App() {
  let AI: AiApiAdaptor | null = null;

  async function initAiApiAdaptor() {
    AI = new AiApiAdaptor()
    await AI.initServices(
      [
        new chatanywhereAIService(['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4']),
        new xunfeiSparkAPIAIService(['generalv3']),
        new kimiAPIAIService(["moonshot-v1-8k"])
      ])
  }
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    const { payload } = message;

    const MessageHandler = {
      sendToAi: async () => {
        const processedMsg = await preprocessMsg(payload)
        if (!AI) { await initAiApiAdaptor() }
        console.log('AI', AI)
        if (processedMsg) {
          const response = await AI?.chat(processedMsg);
          console.log('response', response)
        }


      }
    }
    const action = message.action as keyof typeof MessageHandler;
    MessageHandler[action] && MessageHandler[action]();

  })


  // await AI.chat(checkBaseInfoMatch);
  const [count, setCount] = useState(0);
  const handleClick = function () {
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

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import reactLogo from "@/assets/react.svg";
import wxtLogo from "/wxt.svg";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ApiKeysConfigComponent from "./components/ApiKeysConfigComponent";
import { Aperture, CopyIcon, XIcon, Loader } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import TargetLanguageSetting from "./components/TargetLanguageSetting";
import PromptTemplate from "./components/PromptTemplate";
function App() {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    loading ? <div className="container mx-auto max-w-4xl p-6 flex flex-col justify-center items-center h-screen">
      <h1 className="mb-6 text-4xl font-semibold">Vocabify</h1>
      <div className="animate-spin">
        <Loader className="animate-scaleUp" />
      </div>
    </div> :
      <div className="container mx-auto max-w-4xl p-6">
        {/* <Button onClick={handleClick}>Hello wxt + Shadcn</Button> */}
        <ApiKeysConfigComponent />
        <TargetLanguageSetting />
        <PromptTemplate />
      </div>
  );
}

export default App;

import { Edit, LoaderPinwheel, Save } from "lucide-react";
import { forwardRef, Ref, useImperativeHandle, useState } from "react";
import Typed from "typed.js";
// https://github.com/FormidableLabs/use-editable?tab=readme-ov-file
// useEditable 用于解决contentEditable元素编辑的时候光标跳动问题,为什么要使用 contentEditable div 而不是 textarea呢? 是因为 typedjs 打字机效果在 textarea 下第二次触发时没有动画效果
import { Button } from "@/components/ui/button";
import { AiApiAdaptor } from "@/lib/aiModels";
import { chatanywhereAIService } from "@/lib/aiModels/chatanywhere";
import { kimiAPIAIService } from "@/lib/aiModels/kimi";
import { xunfeiSparkAPIAIService } from "@/lib/aiModels/xunfeiSpark";
import { cn } from "@/lib/utils";
import { marked } from "marked";
import { toast } from "sonner";
import { useEditable } from "use-editable";
import Placeholder from "../components/Placeholder";
import preprocessMsg from "../utils/preprocessMsg";

type EditorProps = {
  Record: { wordOrPhrase: string; meaning?: string };
};
export default function Editor({ Record }: EditorProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(Record.meaning || "");
  const [htmlContent, setHtmlContent] = useState(marked.parse(text));
  const [edit, setEdit] = useState(false);

  type EditableRef = { setEdit: (edit: boolean) => void };
  // useEditable(textRef, setText);
  const onEditableChange = useCallback((text: string) => {
    setText(text);
    setHtmlContent(marked.parse(text));
  }, []);
  useEditable(textRef, onEditableChange, {
    disabled: false,
    indentation: 2,
  });

  const [ailoading, setAiloading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  let AI: AiApiAdaptor | null = null;
  async function initAiApiAdaptor() {
    AI = new AiApiAdaptor();
    await AI.initServices([
      new chatanywhereAIService([
        "gpt-4o-mini",
        "gpt-3.5-turbo",
        "gpt-4o",
        "gpt-4",
      ]),
      new xunfeiSparkAPIAIService(["generalv3"]),
      new kimiAPIAIService(["moonshot-v1-8k"]),
    ]);
  }
  const MessageHandler = {
    sendToAi: async (payload: any) => {
      const processedMsg = await preprocessMsg(payload);
      setText("");
      setIsAnswering(false);

      if (!AI) {
        await initAiApiAdaptor();
      }
      if (processedMsg) {
        setAiloading(true);
        const response = await AI?.chat(processedMsg);
        setIsAnswering(true);
        const textRefCurrent = textRef.current;
        if (textRefCurrent) {
          const typed = new Typed(textRefCurrent, {
            strings: [response!],
            showCursor: false,
            onStringTyped: (self) => {
              console.log("self", self);
            },
            onComplete: () => {
              setText(response!);
              setAiloading(false);
              setIsAnswering(false);
              typed.destroy(); // 销毁 Typed 实例
            },
          });
        }
      }
    },
  };
  useEffect(() => {
    const messageListener = async (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      const { payload } = message;

      const action = message.action as keyof typeof MessageHandler;
      MessageHandler[action] && MessageHandler[action](payload);
    };
    chrome.runtime.onMessage.addListener(messageListener);

    // 监听 打字机文本变化,实时 转markdown 渲染
    const observer = new MutationObserver(() => {
      textRef.current?.textContent &&
        setHtmlContent(marked.parse(textRef.current?.textContent));
    });
    textRef?.current &&
      observer.observe(textRef?.current, { childList: true, subtree: true });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      observer.disconnect();
    };
  }, []);

  const handleSave = async () => {
    setEdit(false);
    const response = await chrome.runtime.sendMessage({
      action: "saveWordOrPhrase",
      payload: {
        wordOrPhrase: Record.wordOrPhrase,
        meaning: text,
      },
    });
    if (response.status === "success") {
      toast(response.message.title, {
        description: response.message.detail,
      });
    } else if (response.status === "error") {
      toast("Failed😵‍💫😵‍💫😵‍💫", {
        description: "Something happend while saving.",
      });
    }
  };

  const handleAiRegenrate = async () => {
    await MessageHandler.sendToAi(Record.wordOrPhrase);
  };

  return (
    <div className="relative">
      {/* AI Display and Edit area */}
      <div
        className={cn(
          "overflow-auto max-h-64 scrollbar-thin",
          "edit-wrapper text-base whitespace-break-spaces rounded-sm p-2 bg-indigo-400/10"
        )}
        style={{
          display: edit ? "block" : "none",
        }}
      >
        <div
          id="text-target"
          contentEditable
          suppressContentEditableWarning
          ref={textRef}
          className="focus:outline-none"
        >
          {text}
        </div>
      </div>

      <div
        className={cn(
          "overflow-auto max-h-64 scrollbar-thin",
          "html-wrapper p-2 prose",
          "dark:prose-invert prose-strong:text-indigo-500"
        )}
        style={{
          display: edit || !htmlContent ? "none" : "block",
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent as string }} // 动态渲染的 HTML
      />

      {/* Operation Btns  */}
      {Record.wordOrPhrase && (
        <div className="text-end mt-1">
          {edit ? (
            <>
              <Button
                variant="ghost"
                className="ml-2"
                size="sm"
                disabled={isAnswering || ailoading}
                onClick={handleAiRegenrate}
              >
                AI regenerate{" "}
                <LoaderPinwheel
                  className={cn((isAnswering || ailoading) && "animate-spin")}
                />
              </Button>
              <Button
                variant="ghost"
                className="ml-2"
                size="sm"
                disabled={isAnswering || ailoading}
                onClick={handleSave}
              >
                Save <Save />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={isAnswering || ailoading}
              onClick={() => setEdit(true)}
            >
              Edit <Edit />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

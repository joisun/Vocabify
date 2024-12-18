import { Edit, LoaderPinwheel, RefreshCw, Save } from 'lucide-react'
import { useState } from 'react'
import Typed from 'typed.js'
// https://github.com/FormidableLabs/use-editable?tab=readme-ov-file
// useEditable 用于解决contentEditable元素编辑的时候光标跳动问题,为什么要使用 contentEditable div 而不是 textarea呢? 是因为 typedjs 打字机效果在 textarea 下第二次触发时没有动画效果
import { Button } from '@/components/ui/button'
import { AiApiAdaptor } from '@/lib/aiModels'
import { chatanywhereAIService } from '@/lib/aiModels/chatanywhere'
import { kimiAPIAIService } from '@/lib/aiModels/kimi'
import { xunfeiSparkAPIAIService } from '@/lib/aiModels/xunfeiSpark'
import { cn } from '@/lib/utils'
import { marked } from 'marked'
import { toast } from 'sonner'
import { useEditable } from 'use-editable'
import Placeholder from '../components/Placeholder'
import preprocessMsg from '../utils/preprocessMsg'
export default function NewRecord() {
  const textRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [htmlContent, setHtmlContent] = useState(marked.parse(text))
  const [edit, setEdit] = useState(false)
  // useEditable(textRef, setText);
  const onEditableChange = useCallback((text: string) => {
    setText(text)
    setHtmlContent(marked.parse(text))
  }, [])
  useEditable(textRef, onEditableChange, {
    disabled: false,
    indentation: 2,
  })

  const [selection, setSelection] = useState('')
  const [ailoading, setAiloading] = useState(false)
  const [isAnswering, setIsAnswering] = useState(false)

  let AI: AiApiAdaptor | null = null
  async function initAiApiAdaptor() {
    AI = new AiApiAdaptor()
    await AI.initServices([
      new chatanywhereAIService(['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4']),
      new xunfeiSparkAPIAIService(['generalv3']),
      new kimiAPIAIService(['moonshot-v1-8k']),
    ])
  }

  const MessageHandler = {
    sendToAi: async (payload: any) => {
      const processedMsg = await preprocessMsg(payload)
      setSelection(payload)
      setText('')
      setIsAnswering(false)

      if (!AI) {
        await initAiApiAdaptor()
      }
      if (processedMsg) {
        setAiloading(true)
        const response = await AI?.chat(processedMsg)
        setIsAnswering(true)
        const textRefCurrent = textRef.current
        if (textRefCurrent) {
          const typed = new Typed(textRefCurrent, {
            strings: [response!],
            showCursor: false,
            typeSpeed: 0,
            backSpeed: 0,
            onStringTyped: (self) => {
              console.log('self', self)
            },
            onComplete: () => {
              setText(response!)
              setAiloading(false)
              setIsAnswering(false)
              typed.destroy() // 销毁 Typed 实例
            },
          })
        }
      }
    },
  }
  useEffect(() => {
    const messageListener = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      const { payload } = message

      const action = message.action as keyof typeof MessageHandler
      MessageHandler[action] && MessageHandler[action](payload)
    }
    chrome.runtime.onMessage.addListener(messageListener)

    // 监听 打字机文本变化,实时 转markdown 渲染
    const observer = new MutationObserver(() => {
      textRef.current?.textContent && setHtmlContent(marked.parse(textRef.current?.textContent))
    })
    textRef?.current && observer.observe(textRef?.current, { childList: true, subtree: true })

    // side panel 首次初始化的时候，去检查 firstSelection 中有没有用户选中的词汇，如果有，取出执行
    firstSelection.getValue().then(async (firstSelectionData) => {
      if (!firstSelectionData.trim()) return
      await MessageHandler.sendToAi(firstSelectionData)
      // 执行完毕后删除缓存值
      firstSelection.removeValue()
    })
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      observer.disconnect()
    }
  }, [])

  const handleSave = async () => {
    setEdit(false)
    const response = await chrome.runtime.sendMessage({
      action: 'saveWordOrPhrase',
      payload: {
        wordOrPhrase: selection,
        meaning: text,
      },
    })
    if (response.status === 'success') {
      toast(response.message.title, {
        description: response.message.detail,
      })
    } else if (response.status === 'error') {
      toast('Failed😵‍💫😵‍💫😵‍💫', {
        description: 'Something happend while saving.',
      })
    }
  }

  const handleAiRegenrate = async () => {
    await MessageHandler.sendToAi(selection)
  }

  return (
    <div className="p-0">
      {!selection && <Placeholder />}

      {/* Selection Text */}
      <div className="relative">
        <p className={cn('flex items-center gap-4', selection ? 'mt-2 mb-6' : '')}>
          {/* wrapper for underline effect */}
          <span>
            <span className="text-2xl bg-gradient-to-b  from-transparent from-70% via-[percentage:70%_70%] via-indigo-600/80  to-indigo-600/80">
              {selection}
            </span>
          </span>
          <span>{ailoading && <LoaderPinwheel className="animate-spin" />}</span>
        </p>

        {/* AI Display and Edit area */}

        <div
          className={cn('edit-wrapper text-base whitespace-break-spaces rounded-md border p-2', 'h-[calc(100vh-18rem)] overflow-auto scrollbar-thin')}
          style={{
            display: edit ? 'block' : 'none',
          }}
        >
          <div id="text-target" contentEditable suppressContentEditableWarning ref={textRef} className="focus:outline-none">
            {text}
          </div>
        </div>

        <div
          className={cn(
            'html-wrapper rounded-md border p-2 prose',
            'dark:prose-invert prose-strong:text-indigo-500',
            'h-[calc(100vh-18rem)] overflow-auto scrollbar-thin'
          )}
          style={{
            display: edit || !htmlContent ? 'none' : 'block',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent as string }} // 动态渲染的 HTML
        />

        {/* Operation Btns  */}
        {selection && (
          <div className="text-end mt-1">
            {!edit && (
              <>
                <Button variant="ghost" className="ml-2" size="sm" disabled={isAnswering || ailoading} onClick={handleAiRegenrate}>
                  Regenerate <RefreshCw />
                </Button>
                <Button variant="ghost" size="sm" disabled={isAnswering || ailoading} onClick={() => setEdit(true)}>
                  Edit <Edit />
                </Button>
              </>
            )}
            <Button variant="ghost" className="ml-2" size="sm" disabled={isAnswering || ailoading} onClick={handleSave}>
              Save <Save />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

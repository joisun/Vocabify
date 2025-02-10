import { Edit, LoaderPinwheel, Save, Volume2 } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import Typed from 'typed.js'
// https://github.com/FormidableLabs/use-editable?tab=readme-ov-file
// useEditable 用于解决contentEditable元素编辑的时候光标跳动问题,为什么要使用 contentEditable div 而不是 textarea呢? 是因为 typedjs 打字机效果在 textarea 下第二次触发时没有动画效果
import { Button } from '@/components/ui/button'

import { aiServiceManager } from '@/lib/aiModels/aiServiceManager'
import { cn } from '@/lib/utils'
import { marked } from 'marked'
import { toast } from 'sonner'
import { useEditable } from 'use-editable'
import preprocessMsg from '../utils/preprocessMsg'
import { speak } from '../utils/tts'

type EditorProps = {
  Record: { wordOrPhrase: string; meaning?: string }
}
export default function Editor({ Record }: EditorProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState(Record.meaning || '')
  const [htmlContent, setHtmlContent] = useState(marked.parse(text))
  const [edit, setEdit] = useState(false)

  type EditableRef = { setEdit: (edit: boolean) => void }
  // useEditable(textRef, setText);
  const onEditableChange = useCallback((text: string) => {
    setText(text)
    setHtmlContent(marked.parse(text))
  }, [])
  useEditable(textRef, onEditableChange, {
    disabled: false,
    indentation: 2,
  })

  const [ailoading, setAiloading] = useState(false)
  const [isAnswering, setIsAnswering] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)

  const MessageHandler = {
    sendToAi: async (payload: any) => {
      const processedMsg = await preprocessMsg(payload)
      setText('')
      setIsAnswering(false)

      if (processedMsg) {
        setAiloading(true)
        try {
          // const response = await AI?.chat(processedMsg);
          const response = await aiServiceManager.getExplanation(payload)
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
        } catch (error) {
          setAiloading(false)
          setIsAnswering(false)
          toast('Failed😵', {
            description: (error as Error).message,
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
        wordOrPhrase: Record.wordOrPhrase,
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
    await MessageHandler.sendToAi(Record.wordOrPhrase)
  }

  const handlePlayAudio = async () => {
    await speak(Record.wordOrPhrase, setTtsLoading)
  }

  return (
    <div className="relative">
      {/* AI Display and Edit area */}
      <div
        className={cn('overflow-auto max-h-64 scrollbar-thin', 'edit-wrapper text-base whitespace-break-spaces rounded-sm p-2 bg-indigo-400/10')}
        style={{
          display: edit ? 'block' : 'none',
        }}
      >
        <div id="text-target" contentEditable suppressContentEditableWarning ref={textRef} className="focus:outline-none">
          {text}
        </div>
      </div>

      <div
        className={cn('overflow-auto max-h-64 scrollbar-thin', 'html-wrapper p-2 prose prose-sm', 'dark:prose-invert prose-strong:text-indigo-500')}
        style={{
          display: edit || !htmlContent ? 'none' : 'block',
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent as string }} // 动态渲染的 HTML
      />

      {/* Operation Btns  */}
      {Record.wordOrPhrase && (
        <div className="text-end mt-1">
          {edit ? (
            <>
              <Button variant="ghost" className="ml-2" size="sm" disabled={isAnswering || ailoading} onClick={handleAiRegenrate}>
                AI regenerate <LoaderPinwheel className={cn((isAnswering || ailoading) && 'animate-spin')} />
              </Button>
              <Button variant="ghost" className="ml-2" size="sm" disabled={isAnswering || ailoading} onClick={handleSave}>
                Save <Save />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" disabled={isAnswering || ailoading} onClick={() => setEdit(true)}>
                Edit <Edit />
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePlayAudio} disabled={ttsLoading}>
                {ttsLoading ? <LoaderPinwheel className="animate-spin" /> : <Volume2 />}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

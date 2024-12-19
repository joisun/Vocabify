import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { firstCheckRecord, firstSelection } from '@/utils/storage'
import { Settings } from 'lucide-react'
import { isValidElement } from 'react'

export const Layout = ({ children }: { children: React.ReactElement[] }) => {
  type SubPanelType = 'NewRecordPanel' | 'RecordsPanel'
  const panels = [...children].reduce((acc: { [x: string]: React.ReactElement }, child) => {
    if (isValidElement(child)) {
      const { type } = child
      if (typeof type === 'function') {
        acc[type.name] = child // 将各个子组件分类存储
      }
    }
    return acc
  }, {}) as { [key in SubPanelType]: React.ReactElement }

  const [activeTab, setActiveTab] = useState('newrecord')

  const handleClickSetting = () => {
    chrome.runtime.openOptionsPage()
  }

  const MessageHandler = {
    sendToAi: async (payload?: any) => {
      setActiveTab('newrecord')
    },
    checkWord: async (payload?: any) => {
      console.log('triggerfffff')
      setActiveTab('records')
    },
  }
  useEffect(() => {
    const messageListener = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      const { payload } = message

      const action = message.action as keyof typeof MessageHandler
      MessageHandler[action] && MessageHandler[action](payload)
    }
    chrome.runtime.onMessage.addListener(messageListener)

    firstSelection.getValue().then((value) => {
      if (value.trim()) {
        MessageHandler.sendToAi()
      }
    })
    firstCheckRecord.getValue().then((value) => {
      if (value.trim()) {
        MessageHandler.checkWord()
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  return (
    <div className="flex m-2">
      <Tabs defaultValue="newrecord" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex justify-between">
          <div>
            <TabsTrigger value="newrecord">New Record</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
          </div>
          <Button variant={'ghost'} onClick={handleClickSetting}>
            <Settings />
          </Button>
        </TabsList>
        {/* https://github.com/radix-ui/primitives/issues/1155#issuecomment-1712307236 解决tabs切换 re-render 问题 */}
        <TabsContent value="newrecord" forceMount hidden={activeTab !== 'newrecord'}>
          <Card>
            <CardContent className="p-2">{panels.NewRecordPanel}</CardContent>
          </Card>
        </TabsContent>
        {/* 如果不指定 forceMount 那么就会重新渲染*/}
        <TabsContent value="records"  hidden={activeTab !== 'records'}>
          <Card>
            <CardContent className="p-2">{panels.RecordsPanel}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// NewRecordPanel 组件
export const NewRecordPanel = ({ children }: { children?: React.ReactElement }) => <>{children}</>

// RecordsPanel 组件
export const RecordsPanel = ({ children }: { children?: React.ReactElement }) => <>{children}</>

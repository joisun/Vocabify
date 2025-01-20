import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { firstCheckRecord, firstSelection } from '@/utils/storage'
import { Settings, RefreshCcw } from 'lucide-react'
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

  const handleClickAsync = () => {
    const clientId = 'Ov23liwjMLi50xHATOtV'
    const clientSecret = 'c169b239c8b3bf18cca076ccc2f7b41684373eff'
    // const redirectUri = `chrome-extension://ppmbokdjdpifcjleoikhfgnhegcihdll/sidepanel.html`
    // const authLink = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=SCOPE`
    // console.log('authLink',authLink)
    // window.location.href = authLink

    // 使用 chrome.identity API 开始 OAuth 流程
    const redirectUri = chrome.identity.getRedirectURL()
    console.log('redirectUri',redirectUri)
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      function (redirectUrl) {
        if (chrome.runtime.lastError || !redirectUrl) {
          console.error('Error during authentication:', chrome.runtime.lastError)
          return
        }

        // 提取 code
        const urlParams = new URLSearchParams(new URL(redirectUrl).search)
        const code = urlParams.get('code')

        // 请求 GitHub 的 access token
        fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret, // 注意隐私，尽量放在安全位置
            code: code,
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            const accessToken = data.access_token
            console.log('data',data)
            console.log('Access Token:', accessToken)
            // 继续您的 API 调用或保存令牌
          })
          .catch((error) => console.error('Error:', error))
      }
    )
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
          <div className="flex items-center">
            <Button size="icon" variant={'ghost'} onClick={handleClickSetting}>
              <Settings />
            </Button>
            <Button size="icon" variant={'ghost'} onClick={handleClickAsync}>
              <RefreshCcw />
            </Button>
          </div>
        </TabsList>
        {/* https://github.com/radix-ui/primitives/issues/1155#issuecomment-1712307236 解决tabs切换 re-render 问题 */}
        <TabsContent value="newrecord" forceMount hidden={activeTab !== 'newrecord'}>
          <Card>
            <CardContent className="p-2">{panels.NewRecordPanel}</CardContent>
          </Card>
        </TabsContent>
        {/* 如果不指定 forceMount 那么就会重新渲染*/}
        <TabsContent value="records" hidden={activeTab !== 'records'}>
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

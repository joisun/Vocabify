import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { checkTokenValidity, createRepo, repoExists, syncLocalAndRemoteData } from '@/lib/githubapi'
import { firstCheckRecord, firstSelection, githubAccessToken } from '@/utils/storage'
import { Settings, RefreshCw } from 'lucide-react'
import { isValidElement } from 'react'
import { toast } from 'sonner'

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
  const [loading, setLoading] = useState(false)

  const handleClickSetting = () => {
    chrome.runtime.openOptionsPage()
  }

  const login = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const clientId = 'Ov23liwjMLi50xHATOtV'
      const clientSecret = 'c169b239c8b3bf18cca076ccc2f7b41684373eff'
      // 使用 chrome.identity API 开始 OAuth 流程
      const redirectUri = chrome.identity.getRedirectURL()
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user:email`
      // createRepo
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        function (redirectUrl) {
          if (chrome.runtime.lastError || !redirectUrl) {
            console.error('Error during authentication:', chrome.runtime.lastError)
            toast('Might be Network issue❌', {
              description: 'Something happened while saving.',
            })
            setLoading(false)
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
            .then(async (data) => {
              const accessToken = data.access_token
              console.log('data', data)
              console.log('Access Token:', accessToken)
              resolve(accessToken)
              await githubAccessToken.setValue(accessToken)

              // 继续您的 API 调用或保存令牌
            })
            .catch((error) => {
              reject()
              console.error('Error:', error)
            })
        }
      )
    })
  }

  const handleClickAsync = async () => {
    setLoading(true)
    try {
      let token = await githubAccessToken.getValue()
      if (!token  || !(await checkTokenValidity(token))) {
        token = await login()
      }
      const exist = await repoExists(token)
      if (!exist) {
        await createRepo(token)
      }
      const sync = await syncLocalAndRemoteData(token)
      setLoading(false)
      toast('Sync Success ✨', {
        description: 'The record has been synced.',
      })
    } catch (e) {
      setLoading(false)
      toast('Sync Failed 🥵', {
        description: 'The record has not been synced.',
      })
      console.error('Sync Failed:\n', e)
    }
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
            <Button size="icon" variant={'ghost'} onClick={handleClickAsync} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin ' : ''} />
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

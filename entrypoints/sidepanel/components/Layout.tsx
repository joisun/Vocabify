import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { Provider, KeepAlive } from 'react-keep-alive'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

  const handleClickSetting = () => {
    chrome.runtime.openOptionsPage()
  }

  const [activeTab, setActiveTab] = useState('newrecord')
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

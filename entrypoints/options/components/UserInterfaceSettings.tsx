import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { hightlightStyle, recordPageSize } from '@/utils/storage'
import { Minus, Plus } from 'lucide-react'
import { RgbaColorPicker } from 'react-colorful'
import { toast } from 'sonner'
import HeadlingTitle from './common/HeadlingTitle'
import OptionSection from './OptionSection'

export default function UserInterfaceSettings() {
  return (
    <OptionSection>
      <HeadlingTitle>UI Settings</HeadlingTitle>
      <div className="grid grid-cols-1 justify-items-start">
        <PageSizeSetter />
        <HighlightStyleSetter />
      </div>
    </OptionSection>
  )
}

const PageSizeSetter = ({ ...props }) => {
  const [pageSize, setPageSize] = useState(3)
  const handleSetPageSize = (isIncrement: boolean) => {
    const newPageSize = isIncrement ? pageSize + 1 : pageSize - 1 > 0 ? pageSize - 1 : pageSize
    setPageSize(newPageSize)
    recordPageSize.setValue(newPageSize)
  }

  useEffect(() => {
    recordPageSize.getValue().then((res) => {
      res && setPageSize(res)
    })
  }, [])
  return (
    <Card className={cn('px-4 py-2 w-full flex items-center  space-x-2 mt-2', props.className)}>
      <label className="text-sm whitespace-nowrap font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Records Page Size：
      </label>
      <Button className="" variant="ghost" size="icon" onClick={() => handleSetPageSize(false)}>
        <Minus />
      </Button>
      <span className="mx-1">{pageSize}</span>
      <Button className="" variant="ghost" size="icon" onClick={() => handleSetPageSize(true)}>
        <Plus />
      </Button>
    </Card>
  )
}
const HighlightStyleSetter = () => {
  const [initialized, setInitialized] = useState(false)
  const [settings, setSettings] = useState({
    type: 'underline',
    style: 'solid',
    offset: '1',
    thickness: '1',
    color: { r: 200, g: 150, b: 35, a: 0.5 },
    invertColor: false,
  })

  const typeSet = {
    underline: 'underline',
    'under-over': 'underline overline',
  }

  useEffect(() => {
    hightlightStyle.getValue().then((res) => {
      if (res) {
        setSettings(res)
        setInitialized(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!initialized) return
    console.log('settings', settings)
    hightlightStyle
      .setValue(settings)
      .then(() => {
        toast('Done🎉', {
          description: 'Highlight style settings saved.',
        })
      })
      .catch(() => {
        toast('Failed', {
          description: 'Save failed. Please try again.',
        })
      })
  }, [initialized, settings])

  const updateSettings = (updates: Partial<typeof settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  return (
    <Card className={cn('px-4 py-2 mt-2 w-full')}>
      <p className="flex gap-4 mb-2 items-center bg-white/10 px-4 rounded-md">
        <Label>Highlight Style</Label>
        <span
          className={cn('whitespace-nowrap text-foreground my-4 space-x-4')}
          style={{
            color: settings.invertColor ? `rgba(${255 - settings.color.r}, ${255 - settings.color.g}, ${255 - settings.color.b})` : undefined,
            textDecorationLine: settings.type !== 'background' ? typeSet[settings.type as keyof typeof typeSet] : undefined,
            textDecorationColor:
              settings.type !== 'background' ? `rgba(${settings.color.r}, ${settings.color.g}, ${settings.color.b}, ${settings.color.a})` : undefined,
            textDecorationStyle: settings.type !== 'background' ? (settings.style as any) : undefined,
            textDecorationThickness: settings.type !== 'background' ? `${settings.thickness}px` : undefined,
            textUnderlineOffset: settings.type !== 'background' ? `${settings.offset}px` : undefined,
            backgroundColor:
              settings.type === 'background' ? `rgba(${settings.color.r}, ${settings.color.g}, ${settings.color.b}, ${settings.color.a})` : undefined,
          }}
        >
          <span className='font-bold text-2xl'>Headling level 1</span>
          <span className='font-semibold text-xl'>Headling level 2</span>
          <span className='font-medium text-lg'>Headling level 3</span>
          <span className=''>Paragraph Lorem ipsum dolor.</span>
        </span>
      </p>

      <div className="grid grid-cols-2 justify-items-start space-y-1">
        <div className="flex items-center flex-nowrap">
          <label className="text-sm whitespace-nowrap font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Decoration Type：
          </label>
          <Select onValueChange={(value) => updateSettings({ type: value })} value={settings.type}>
            <SelectTrigger>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="underline">underline</SelectItem>
                <SelectItem value="under-over">under-over line</SelectItem>
                <SelectItem value="background">background</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {settings.type !== 'background' && (
          <div className="flex items-center flex-nowrap">
            <label className="text-sm whitespace-nowrap font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Decoration Line Style：
            </label>
            <Select onValueChange={(value) => updateSettings({ style: value })} value={settings.style}>
              <SelectTrigger>
                <SelectValue placeholder="Decoration Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="solid">solid</SelectItem>
                  <SelectItem value="double">double</SelectItem>
                  <SelectItem value="dotted">dotted</SelectItem>
                  <SelectItem value="dashed">dashed</SelectItem>
                  <SelectItem value="wavy">wavy</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        {settings.type !== 'background' && (
          <div className="flex items-center flex-nowrap">
            <label className="text-sm whitespace-nowrap font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Decoration Offset：
            </label>
            <Select onValueChange={(value) => updateSettings({ offset: value })} value={settings.offset}>
              <SelectTrigger>
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        {settings.type !== 'background' && (
          <div className="flex items-center flex-nowrap">
            <label className="text-sm whitespace-nowrap font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Decoration Thickness：
            </label>
            <Select onValueChange={(value) => updateSettings({ thickness: value })} value={settings.thickness}>
              <SelectTrigger>
                <SelectValue placeholder="Decoration Thickness" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center flex-nowrap">
          <label className="text-sm whitespace-nowrap font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Decoration Color：
          </label>
          <Select>
            <SelectTrigger style={{ backgroundColor: `rgba(${settings.color.r}, ${settings.color.g}, ${settings.color.b}, ${settings.color.a})` }}>
              <SelectValue placeholder="Decoration Color" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <RgbaColorPicker color={settings.color} onChange={(color) => updateSettings({ color })} />
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="terms"
            className="rounded-sm h-6 w-6"
            checked={settings.invertColor}
            onCheckedChange={(val: boolean) => updateSettings({ invertColor: val })}
          />
          <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Invert text color from decoration color
          </label>
        </div>
      </div>
    </Card>
  )
}

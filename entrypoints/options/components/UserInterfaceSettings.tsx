import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { hightlightStyle, recordPageSize } from '@/utils/storage'
import { Brush, Highlighter, Minus, Plus } from 'lucide-react'
import { RgbaColorPicker } from 'react-colorful'
import { toast } from 'sonner'
import HeadlingTitle from './common/HeadlingTitle'
import Subtitle from './common/Subtitle'
import OptionSection from './OptionSection'

export default function UserInterfaceSettings() {
  return (
    <OptionSection>
      <HeadlingTitle>
        <Brush className="h-5 w-5 text-primary" />
        Appearance
      </HeadlingTitle>
      <Subtitle>Personalise how saved words are highlighted on every page.</Subtitle>

      <div className="grid gap-3">
        <PageSizeSetter />
        <HighlightStyleSetter />
      </div>
    </OptionSection>
  )
}

const PageSizeSetter = () => {
  const [pageSize, setPageSize] = useState(3)

  const handleSetPageSize = (isIncrement: boolean) => {
    const newPageSize = isIncrement
      ? pageSize + 1
      : pageSize - 1 > 0
      ? pageSize - 1
      : pageSize
    setPageSize(newPageSize)
    recordPageSize.setValue(newPageSize)
  }

  useEffect(() => {
    recordPageSize.getValue().then((res: number | null) => {
      if (res) setPageSize(res)
    })
  }, [])

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/30 px-4 py-3">
      <div>
        <Label className="text-[14px] font-medium text-foreground">Records per page</Label>
        <p className="text-[12px] text-muted-foreground">How many words to show in the list.</p>
      </div>
      <div className="inline-flex items-center gap-1 rounded-full bg-background border border-border/60 p-0.5 shadow-apple-xs">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => handleSetPageSize(false)}
          aria-label="Decrease page size"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="tabular w-6 text-center text-[14px] font-medium" aria-live="polite">
          {pageSize}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => handleSetPageSize(true)}
          aria-label="Increase page size"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

const HighlightStyleSetter = () => {
  const [initialized, setInitialized] = useState(false)
  const [settings, setSettings] = useState({
    type: 'underline',
    style: 'solid',
    offset: '1',
    thickness: '1',
    color: { r: 0, g: 122, b: 255, a: 0.45 },
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
    hightlightStyle
      .setValue(settings)
      .then(() => {
        toast.success('Highlight style saved')
      })
      .catch(() => {
        toast.error('Save failed', {
          description: 'Please try again.',
        })
      })
  }, [initialized, settings])

  const updateSettings = (updates: Partial<typeof settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  const decoColor = `rgba(${settings.color.r}, ${settings.color.g}, ${settings.color.b}, ${settings.color.a})`

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Highlighter className="h-4 w-4 text-primary" />
        <Label className="text-[14px] font-medium text-foreground">Highlight style</Label>
      </div>

      {/* Live preview */}
      <div className="rounded-lg bg-background border border-border/60 px-4 py-3">
        <p
          className="leading-relaxed"
          style={{
            color: settings.invertColor
              ? `rgba(${255 - settings.color.r}, ${255 - settings.color.g}, ${255 - settings.color.b})`
              : undefined,
            textDecorationLine: settings.type !== 'background' ? typeSet[settings.type as keyof typeof typeSet] : undefined,
            textDecorationColor: settings.type !== 'background' ? decoColor : undefined,
            textDecorationStyle: settings.type !== 'background' ? (settings.style as any) : undefined,
            textDecorationThickness: settings.type !== 'background' ? `${settings.thickness}px` : undefined,
            textUnderlineOffset: settings.type !== 'background' ? `${settings.offset}px` : undefined,
            backgroundColor: settings.type === 'background' ? decoColor : undefined,
          }}
        >
          <span className="font-display text-2xl font-semibold tracking-tight">Vocabulary</span>{' '}
          <span className="text-muted-foreground">— preview your highlight in context.</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Decoration">
          <Select onValueChange={(v) => updateSettings({ type: v })} value={settings.type}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="underline">Underline</SelectItem>
                <SelectItem value="under-over">Under + Over line</SelectItem>
                <SelectItem value="background">Background</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>

        {settings.type !== 'background' && (
          <FieldRow label="Line style">
            <Select onValueChange={(v) => updateSettings({ style: v })} value={settings.style}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="wavy">Wavy</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldRow>
        )}

        {settings.type !== 'background' && (
          <FieldRow label="Offset">
            <Select onValueChange={(v) => updateSettings({ offset: v })} value={settings.offset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="0">0 px</SelectItem>
                  <SelectItem value="1">1 px</SelectItem>
                  <SelectItem value="2">2 px</SelectItem>
                  <SelectItem value="4">4 px</SelectItem>
                  <SelectItem value="8">8 px</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldRow>
        )}

        {settings.type !== 'background' && (
          <FieldRow label="Thickness">
            <Select onValueChange={(v) => updateSettings({ thickness: v })} value={settings.thickness}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">1 px</SelectItem>
                  <SelectItem value="2">2 px</SelectItem>
                  <SelectItem value="4">4 px</SelectItem>
                  <SelectItem value="8">8 px</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldRow>
        )}

        <FieldRow label="Color">
          <Select>
            <SelectTrigger className="relative">
              <span
                className="absolute left-3 inline-block h-4 w-4 rounded-full ring-1 ring-border"
                style={{ backgroundColor: decoColor }}
                aria-hidden
              />
              <SelectValue placeholder="Pick a color" />
              <span className="ml-7 font-mono text-[12px] text-muted-foreground">
                rgba({settings.color.r}, {settings.color.g}, {settings.color.b}, {settings.color.a})
              </span>
            </SelectTrigger>
            <SelectContent>
              <div className="p-3">
                <RgbaColorPicker color={settings.color} onChange={(color) => updateSettings({ color })} />
              </div>
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="flex items-center gap-2 sm:col-span-2 mt-1">
          <Checkbox
            id="invert-color"
            className="rounded-md h-5 w-5"
            checked={settings.invertColor}
            onCheckedChange={(val: boolean) => updateSettings({ invertColor: val })}
          />
          <label
            htmlFor="invert-color"
            className={cn(
              "text-[13px] font-medium leading-none text-foreground/90 cursor-pointer",
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            )}
          >
            Invert text color from decoration color
          </label>
        </div>
      </div>
    </div>
  )
}

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
      {label}
    </span>
    {children}
  </div>
)

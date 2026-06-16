import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { hightlightStyle, recordPageSize } from '@/utils/storage'
import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { RgbaColorPicker } from 'react-colorful'
import { toast } from 'sonner'
import OptionSection from './OptionSection'

export default function UserInterfaceSettings() {
  return (
    <OptionSection
      id="appearance"
      title="Appearance"
      description="Personalise how saved words are highlighted on every page."
    >
      <PageSizeSetter />
      <HighlightStyleSetter />
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
    <div className="flex items-center justify-between border-b border-border pb-4 dark:border-white/[0.04]">
      <div>
        <Label className="text-[13px] font-medium">Records per page</Label>
        <p className="text-[12px] text-muted-foreground">How many words to show in the list.</p>
      </div>
      <div className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card p-0.5 dark:border-white/[0.04]">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleSetPageSize(false)}
          aria-label="Decrease"
          className="h-6 w-6"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="tabular w-6 text-center text-[12px] font-medium" aria-live="polite">
          {pageSize}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleSetPageSize(true)}
          aria-label="Increase"
          className="h-6 w-6"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

const HighlightStyleSetter = () => {
  const hydratedRef = useRef(false)
  const userEditedRef = useRef(false)
  const [settings, setSettings] = useState({
    type: 'underline',
    style: 'solid',
    offset: '1',
    thickness: '1',
    color: { r: 91, g: 91, b: 248, a: 0.45 },
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
      }
      hydratedRef.current = true
    })
  }, [])

  useEffect(() => {
    if (!hydratedRef.current || !userEditedRef.current) return
    hightlightStyle
      .setValue(settings)
      .then(() => toast.success('Highlight style saved'))
      .catch(() => toast.error('Save failed'))
  }, [settings])

  const updateSettings = (updates: Partial<typeof settings>) => {
    userEditedRef.current = true
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  const decoColor = `rgba(${settings.color.r}, ${settings.color.g}, ${settings.color.b}, ${settings.color.a})`

  return (
    <div className="space-y-4">
      <Label className="text-[13px] font-medium">Custom highlight style</Label>

      <div className="rounded-[6px] border border-border bg-secondary px-4 py-3 dark:border-white/[0.04]">
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
          <span className="font-display text-base font-semibold tracking-tight">Vocabulary</span>{' '}
          <span className="text-muted-foreground">— preview your highlight in context.</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <SelectTrigger className="relative h-8 pl-2.5">
              <span
                className="inline-block h-3 w-3 rounded-full ring-1 ring-border/60"
                style={{ backgroundColor: decoColor }}
                aria-hidden
              />
              <span className="ml-2 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                rgba({settings.color.r}, {settings.color.g}, {settings.color.b}, {settings.color.a})
              </span>
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <RgbaColorPicker color={settings.color} onChange={(color) => updateSettings({ color })} />
              </div>
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="invert-color"
            className="rounded-sm h-4 w-4"
            checked={settings.invertColor}
            onCheckedChange={(val: boolean) => updateSettings({ invertColor: val })}
          />
          <label
            htmlFor="invert-color"
            className={cn('text-[12px] font-medium leading-none cursor-pointer')}
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
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    {children}
  </div>
)

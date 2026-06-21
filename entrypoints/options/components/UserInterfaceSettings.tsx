import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FamiliarityLevel } from '@/lib/familiarity'
import { cn } from '@/lib/utils'
import {
  HIGHLIGHT_LEVELS,
  EDGE_TTS_VOICES,
  hightlightStyle,
  normalizeHighlightStyleSettings,
  type HighlightLevelStyleSettings,
  type HighlightStyleBase,
  type highlightStyleSettingsType,
  normalizeSpeechSettings,
  speechSettings,
  type SpeechProvider,
  type SpeechSettings,
  translationRevealMode,
  type TranslationRevealMode,
} from '@/utils/storage'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { RgbaColorPicker } from 'react-colorful'
import OptionSection from './OptionSection'

type HighlightSettingsState = highlightStyleSettingsType

export default function UserInterfaceSettings() {
  return (
    <OptionSection
      id="appearance"
      title="Appearance"
    >
      <TranslationRevealSetter />
      <HighlightStyleSetter />
    </OptionSection>
  )
}

export function SpeechSettingsSection() {
  return (
    <OptionSection
      id="speech"
      title="Speech"
    >
      <SpeechSettingsSetter />
    </OptionSection>
  )
}

const SpeechSettingsSetter = () => {
  const hydratedRef = useRef(false)
  const [settings, setSettings] = useState<SpeechSettings>(() => normalizeSpeechSettings())

  useEffect(() => {
    speechSettings.getValue().then((value) => {
      setSettings(normalizeSpeechSettings(value))
      hydratedRef.current = true
    })
  }, [])

  function update(patch: Partial<SpeechSettings>) {
    setSettings((prev) => {
      const next = normalizeSpeechSettings({ ...prev, ...patch })
      if (hydratedRef.current) {
        speechSettings.setValue(next).catch((error) => console.error('Speech settings save failed:', error))
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <Label className="text-[13px] font-medium">Speech provider</Label>
        <div className="w-48">
          <Select value={settings.provider} onValueChange={(value) => update({ provider: value as SpeechProvider })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="browser">Browser TTS</SelectItem>
                <SelectItem value="edge">Edge TTS</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {settings.provider === 'edge' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="Edge voice">
            <Select value={settings.edgeVoice} onValueChange={(value) => update({ edgeVoice: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {EDGE_TTS_VOICES.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>{voice.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FieldRow label="Rate">
          <Select value={String(settings.rate)} onValueChange={(value) => update({ rate: Number(value) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="0.75">Slow</SelectItem>
                <SelectItem value="1">Normal</SelectItem>
                <SelectItem value="1.25">Fast</SelectItem>
                <SelectItem value="1.5">Faster</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Pitch">
          <Select value={String(settings.pitch)} onValueChange={(value) => update({ pitch: Number(value) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="0.85">Low</SelectItem>
                <SelectItem value="1">Normal</SelectItem>
                <SelectItem value="1.15">High</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Volume">
          <Select value={String(settings.volume)} onValueChange={(value) => update({ volume: Number(value) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="0.5">50%</SelectItem>
                <SelectItem value="0.75">75%</SelectItem>
                <SelectItem value="1">100%</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      {settings.provider === 'edge' ? (
        <label className="flex items-center gap-2">
          <Checkbox
            className="rounded-sm"
            checked={settings.fallbackToBrowser}
            onCheckedChange={(checked: boolean) => update({ fallbackToBrowser: checked })}
          />
          <span className="cursor-pointer text-[12px] font-medium leading-none">
            Fallback to Browser TTS when Edge fails
          </span>
        </label>
      ) : null}
    </div>
  )
}

const TranslationRevealSetter = () => {
  const [mode, setMode] = useState<TranslationRevealMode>('hover')
  const hydratedRef = useRef(false)

  useEffect(() => {
    translationRevealMode.getValue().then((value) => {
      setMode(value)
      hydratedRef.current = true
    })
  }, [])

  function update(value: TranslationRevealMode) {
    setMode(value)
    if (hydratedRef.current) translationRevealMode.setValue(value)
  }

  return (
    <div className="flex items-center justify-between border-b border-border pb-4 dark:border-white/[0.04]">
      <div>
        <Label className="text-[13px] font-medium">Example translation</Label>
      </div>
      <div className="w-48">
        <Select value={mode} onValueChange={(value) => update(value as TranslationRevealMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="hover">Hide until hover</SelectItem>
              <SelectItem value="always">Always show</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

const HighlightStyleSetter = () => {
  const hydratedRef = useRef(false)
  const userEditedRef = useRef(false)
  const [selectedLevel, setSelectedLevel] = useState<FamiliarityLevel>('NEW')
  const [settings, setSettings] = useState<HighlightSettingsState>(() => normalizeHighlightStyleSettings())

  useEffect(() => {
    hightlightStyle.getValue().then((res) => {
      setSettings(normalizeHighlightStyleSettings(res))
      hydratedRef.current = true
    })
  }, [])

  useEffect(() => {
    if (!hydratedRef.current || !userEditedRef.current) return
    hightlightStyle
      .setValue(settings)
      .catch((error) => console.error('Highlight style save failed:', error))
  }, [settings])

  const updateLevelStyle = (level: FamiliarityLevel, updates: Partial<HighlightLevelStyleSettings>) => {
    userEditedRef.current = true
    setSettings((prev) => {
      const normalized = normalizeHighlightStyleSettings(prev)
      return normalizeHighlightStyleSettings({
        ...normalized,
        levelStyles: {
          ...normalized.levelStyles,
          [level]: {
            ...normalized.levelStyles[level],
            ...updates,
          },
        },
      })
    })
  }

  const normalized = normalizeHighlightStyleSettings(settings)

  return (
    <div className="flex flex-col gap-4">
      <VisibleLevelSetter
        settings={normalized}
        onChange={(level, enabled) => updateLevelStyle(level, { enabled })}
      />

      <div className="rounded-[6px] bg-secondary px-4 py-3 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {HIGHLIGHT_LEVELS.map((level) => (
            <span
              key={level}
              className={cn(
                'text-[13px] font-semibold',
                !isLevelPainted(normalized, level) && 'opacity-35 line-through',
              )}
              style={buildPreviewStyle(normalized.levelStyles[level])}
            >
              {LEVEL_LABELS[level]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[8px] border border-border bg-card p-3 dark:border-white/[0.04]">
        <Label className="text-[13px] font-medium">Level style</Label>

        <Tabs value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as FamiliarityLevel)}>
          <TabsList className="grid w-full grid-cols-4">
            {HIGHLIGHT_LEVELS.map((level) => (
              <TabsTrigger key={level} value={level} className="px-2">
                {LEVEL_LABELS[level]}
              </TabsTrigger>
            ))}
          </TabsList>

          {HIGHLIGHT_LEVELS.map((level) => (
            <TabsContent key={level} value={level} className="flex flex-col gap-3">
              <LevelStylePanel
                level={level}
                style={normalized.levelStyles[level]}
                onChange={(updates) => updateLevelStyle(level, updates)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

function VisibleLevelSetter({
  settings,
  onChange,
}: {
  settings: highlightStyleSettingsType
  onChange: (level: FamiliarityLevel, enabled: boolean) => void
}) {
  const visibleLevels = HIGHLIGHT_LEVELS.filter((level) => settings.levelStyles[level].enabled)
  const label = visibleLevels.length === HIGHLIGHT_LEVELS.length
    ? 'All levels'
    : visibleLevels.length > 0
      ? visibleLevels.map((level) => LEVEL_LABELS[level]).join(', ')
      : 'None'

  return (
    <div className="flex items-center justify-between border-b border-border pb-4 dark:border-white/[0.04]">
      <Label className="text-[13px] font-medium">Visible Level</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 w-48 justify-between px-2.5 font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            {HIGHLIGHT_LEVELS.map((level) => (
              <DropdownMenuCheckboxItem
                key={level}
                checked={settings.levelStyles[level].enabled}
                onCheckedChange={(checked) => onChange(level, checked)}
                onSelect={(event) => event.preventDefault()}
              >
                {LEVEL_LABELS[level]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function LevelStylePanel({
  level,
  style,
  onChange,
}: {
  level: FamiliarityLevel
  style: HighlightLevelStyleSettings
  onChange: (updates: Partial<HighlightStyleBase>) => void
}) {
  return (
    <>
      <div className="flex justify-end">
        <div className="rounded-[6px] bg-secondary px-4 py-3 dark:bg-white/[0.03]">
          <span className="text-[12px] font-semibold" style={buildPreviewStyle(style)}>
            {LEVEL_LABELS[level]} vocabulary
          </span>
        </div>
      </div>

      <HighlightStyleControls
        style={style}
        onChange={onChange}
      />
    </>
  )
}

function HighlightStyleControls({
  style,
  onChange,
}: {
  style: HighlightStyleBase
  onChange: (updates: Partial<HighlightStyleBase>) => void
}) {
  const hasUnderline = hasStyleUnderline(style)
  const hasBackground = hasStyleBackground(style)
  const decoColor = toRgba(style.color, style.color.a)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FieldRow label="Decoration">
        <Select onValueChange={(v) => onChange({ type: v })} value={style.type}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="underline">Underline</SelectItem>
              <SelectItem value="background">Background</SelectItem>
              <SelectItem value="underline-background">Underline + Background</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldRow>

      {hasUnderline && (
        <FieldRow label="Line style">
          <Select onValueChange={(v) => onChange({ style: v })} value={style.style}>
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

      {hasUnderline && (
        <FieldRow label="Offset">
          <Select onValueChange={(v) => onChange({ offset: v })} value={style.offset}>
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

      {hasUnderline && (
        <FieldRow label="Thickness">
          <Select onValueChange={(v) => onChange({ thickness: v })} value={style.thickness}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="1">1 px</SelectItem>
                <SelectItem value="2">2 px</SelectItem>
                <SelectItem value="3">3 px</SelectItem>
                <SelectItem value="4">4 px</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>
      )}

      {hasBackground && (
        <FieldRow label="Background opacity">
          <Select onValueChange={(v) => onChange({ backgroundOpacity: v })} value={style.backgroundOpacity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="0.06">6%</SelectItem>
                <SelectItem value="0.10">10%</SelectItem>
                <SelectItem value="0.14">14%</SelectItem>
                <SelectItem value="0.18">18%</SelectItem>
                <SelectItem value="0.24">24%</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>
      )}

      <FieldRow label="Color">
        <Select>
          <SelectTrigger className="relative h-8 pl-2.5">
            <span
              className="inline-block size-3 rounded-full ring-1 ring-border/60"
              style={{ backgroundColor: decoColor }}
              aria-hidden
            />
            <span className="ml-2 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              rgba({style.color.r}, {style.color.g}, {style.color.b}, {style.color.a})
            </span>
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <RgbaColorPicker color={style.color} onChange={(color) => onChange({ color })} />
            </div>
          </SelectContent>
        </Select>
      </FieldRow>

      <label className="flex items-center gap-2 sm:col-span-2">
        <Checkbox
          className="rounded-sm"
          checked={style.invertColor}
          onCheckedChange={(val: boolean) => onChange({ invertColor: val })}
        />
        <span className={cn('text-[12px] font-medium leading-none cursor-pointer')}>
          Invert text color from decoration color
        </span>
      </label>
    </div>
  )
}

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    {children}
  </div>
)

const LEVEL_LABELS: Record<FamiliarityLevel, string> = {
  NEW: 'New',
  LEARNING: 'Learning',
  FAMILIAR: 'Familiar',
  MASTERED: 'Mastered',
}

function buildPreviewStyle(style: HighlightStyleBase): React.CSSProperties {
  const hasUnderline = hasStyleUnderline(style)
  const hasBackground = hasStyleBackground(style)
  return {
    color: style.invertColor ? `rgb(${255 - style.color.r}, ${255 - style.color.g}, ${255 - style.color.b})` : undefined,
    textDecorationLine: hasUnderline ? 'underline' : undefined,
    textDecorationColor: hasUnderline ? toRgba(style.color, style.color.a) : undefined,
    textDecorationStyle: hasUnderline ? style.style as React.CSSProperties['textDecorationStyle'] : undefined,
    textDecorationThickness: hasUnderline ? `${style.thickness}px` : undefined,
    textUnderlineOffset: hasUnderline ? `${style.offset}px` : undefined,
    backgroundColor: hasBackground ? toRgba(style.color, Number(style.backgroundOpacity)) : undefined,
  }
}

function hasStyleUnderline(style: HighlightStyleBase) {
  return style.type === 'underline' || style.type === 'underline-background'
}

function hasStyleBackground(style: HighlightStyleBase) {
  return style.type === 'background' || style.type === 'underline-background'
}

function toRgba(color: { r: number; g: number; b: number; a: number }, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function isLevelPainted(settings: highlightStyleSettingsType, level: FamiliarityLevel) {
  return settings.levelStyles[level].enabled
}

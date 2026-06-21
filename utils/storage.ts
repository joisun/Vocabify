import { AiAgentApiKeys, normalizeAgentConfigs } from '@/typings/aiModelAdaptor'
import { DefaultPromptTemplate, DefaultLanguage } from '@/const'
import type { FamiliarityLevel } from '@/lib/familiarity'
import type { ThemePreference } from '@/lib/theme'

/**--------------------------- OPTION PAGE ---------------------------*/
/** 自定义 Prompt */
export const promptTemplate = storage.defineItem<string>('local:additionalPrompt', {
  fallback: DefaultPromptTemplate,
})

/** 目标语言 */
export const targetLanguage = storage.defineItem<string>('local:targetLanguage', {
  fallback: DefaultLanguage,
})

/** apikey 设定缓存 */
export const agentsStorage = storage.defineItem<AiAgentApiKeys>('local:agents', {
  fallback: [],
})

export async function getNormalizedAgents() {
  const raw = await agentsStorage.getValue()
  return normalizeAgentConfigs(raw)
}
export const HIGHLIGHT_LEVELS: FamiliarityLevel[] = ['NEW', 'LEARNING', 'FAMILIAR', 'MASTERED']

export type HighlightStyleColor = {
  a: number
  b: number
  g: number
  r: number
}

export type HighlightStyleBase = {
  color: {
    a: number
    b: number
    g: number
    r: number
  }
  invertColor: boolean
  offset: string
  style: string
  thickness: string
  type: 'underline' | 'background' | 'underline-background' | string
  backgroundOpacity: string
}

export type HighlightLevelStyleSettings = HighlightStyleBase & {
  enabled: boolean
}

/** 回显样式 */
export type highlightStyleSettingsType = {
  version: 2
  levelStyles: Record<FamiliarityLevel, HighlightLevelStyleSettings>
}

export type NormalizedHighlightStyleSettings = highlightStyleSettingsType

const DEFAULT_HIGHLIGHT_BASE: HighlightStyleBase = {
  color: {
    a: 0.85,
    b: 113,
    g: 204,
    r: 46,
  },
  invertColor: false,
  offset: '2',
  style: 'solid',
  thickness: '2',
  type: 'underline',
  backgroundOpacity: '0.14',
}

const DEFAULT_LEVEL_STYLES: Record<FamiliarityLevel, HighlightLevelStyleSettings> = {
  NEW: {
    ...DEFAULT_HIGHLIGHT_BASE,
    color: { r: 46, g: 204, b: 113, a: 0.90 },
    backgroundOpacity: '0.18',
    enabled: true,
  },
  LEARNING: {
    ...DEFAULT_HIGHLIGHT_BASE,
    color: { r: 46, g: 204, b: 113, a: 0.76 },
    backgroundOpacity: '0.14',
    enabled: true,
  },
  FAMILIAR: {
    ...DEFAULT_HIGHLIGHT_BASE,
    color: { r: 39, g: 174, b: 96, a: 0.58 },
    backgroundOpacity: '0.10',
    enabled: true,
  },
  MASTERED: {
    ...DEFAULT_HIGHLIGHT_BASE,
    color: { r: 21, g: 128, b: 61, a: 0.38 },
    backgroundOpacity: '0.06',
    enabled: true,
  },
}

export const hightlightStyle = storage.defineItem<highlightStyleSettingsType>('local:hightlightStyle', {
  fallback: createDefaultHighlightSettings(),
})

export function createDefaultHighlightSettings(): NormalizedHighlightStyleSettings {
  return {
    version: 2,
    levelStyles: HIGHLIGHT_LEVELS.reduce((acc, level) => {
      acc[level] = cloneHighlightLevelStyle(DEFAULT_LEVEL_STYLES[level])
      return acc
    }, {} as Record<FamiliarityLevel, HighlightLevelStyleSettings>),
  }
}

export function normalizeHighlightStyleSettings(value?: Partial<highlightStyleSettingsType> | null): NormalizedHighlightStyleSettings {
  if (!value) return createDefaultHighlightSettings()

  const defaultSettings = createDefaultHighlightSettings()
  const levelStyles = HIGHLIGHT_LEVELS.reduce((acc, level) => {
    acc[level] = normalizeHighlightLevelStyle(value.levelStyles?.[level], defaultSettings.levelStyles[level])
    return acc
  }, {} as Record<FamiliarityLevel, HighlightLevelStyleSettings>)

  return {
    version: 2,
    levelStyles,
  }
}

export function shouldHighlightLevelBePainted(
  settings: Partial<highlightStyleSettingsType> | null | undefined,
  level: FamiliarityLevel,
) {
  const normalized = normalizeHighlightStyleSettings(settings)
  const levelStyle = normalized.levelStyles[level]
  return !!levelStyle?.enabled
}

function normalizeHighlightStyleBase(value?: Partial<HighlightStyleBase> | null): HighlightStyleBase {
  const base = value || {}
  return {
    color: normalizeHighlightColor(base.color),
    invertColor: !!base.invertColor,
    offset: ['0', '1', '2', '4', '8'].includes(String(base.offset)) ? String(base.offset) : DEFAULT_HIGHLIGHT_BASE.offset,
    style: ['solid', 'double', 'dotted', 'dashed', 'wavy'].includes(String(base.style)) ? String(base.style) : DEFAULT_HIGHLIGHT_BASE.style,
    thickness: ['1', '2', '3', '4'].includes(String(base.thickness)) ? String(base.thickness) : DEFAULT_HIGHLIGHT_BASE.thickness,
    type: ['underline', 'background', 'underline-background'].includes(String(base.type)) ? String(base.type) : DEFAULT_HIGHLIGHT_BASE.type,
    backgroundOpacity: normalizeOpacity(base.backgroundOpacity, DEFAULT_HIGHLIGHT_BASE.backgroundOpacity),
  }
}

function normalizeHighlightLevelStyle(
  value: Partial<HighlightLevelStyleSettings> | undefined,
  fallback: HighlightLevelStyleSettings,
): HighlightLevelStyleSettings {
  const base = normalizeHighlightStyleBase({
    ...fallback,
    ...value,
  })

  return {
    ...base,
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : fallback.enabled,
  }
}

function normalizeHighlightColor(value?: Partial<HighlightStyleColor> | null): HighlightStyleColor {
  return {
    r: clampColorChannel(value?.r, DEFAULT_HIGHLIGHT_BASE.color.r),
    g: clampColorChannel(value?.g, DEFAULT_HIGHLIGHT_BASE.color.g),
    b: clampColorChannel(value?.b, DEFAULT_HIGHLIGHT_BASE.color.b),
    a: clampUnit(value?.a, DEFAULT_HIGHLIGHT_BASE.color.a),
  }
}

function normalizeOpacity(value: unknown, fallback: string) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(clampUnit(numeric, Number(fallback))) : fallback
}

function clampColorChannel(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(255, Math.round(numeric))) : fallback
}

function clampUnit(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback
}

function cloneHighlightStyleBase(style: HighlightStyleBase): HighlightStyleBase {
  return {
    ...style,
    color: { ...style.color },
  }
}

function cloneHighlightLevelStyle(style: HighlightLevelStyleSettings): HighlightLevelStyleSettings {
  return {
    ...style,
    color: { ...style.color },
  }
}

export const aiMaxRetries = storage.defineItem<number>('local:aiMaxRetries', {
  fallback: 2,
})

export type TranslationRevealMode = 'hover' | 'always'

export const translationRevealMode = storage.defineItem<TranslationRevealMode>('local:translationRevealMode', {
  fallback: 'hover',
})

export const themePreference = storage.defineItem<ThemePreference>('local:vocabify-theme', {
  fallback: 'system',
})

export const githubAccessToken = storage.defineItem<string | null>('local:githubAccessToken', {
  fallback: null,
})

export type GithubSyncAccount = {
  login: string
  repoName: string
}

export const githubSyncAccount = storage.defineItem<GithubSyncAccount | null>('local:githubSyncAccount', {
  fallback: null,
})

export const githubLastSyncAt = storage.defineItem<string | null>('local:githubLastSyncAt', {
  fallback: null,
})

export type ThemePreference = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

const STORAGE_KEY = 'vocabify-theme'

function normalizeTheme(value: unknown): ThemePreference | null {
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}

export function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const theme = normalizeTheme(stored)
    if (theme) return theme
  } catch {}
  return 'system'
}

export function setStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
}

export async function getStoredThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    const theme = normalizeTheme(stored[STORAGE_KEY])
    if (theme) return theme
  } catch {}
  return getStoredTheme()
}

export async function setStoredThemePreference(theme: ThemePreference): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: theme })
  } catch {}
  setStoredTheme(theme)
}

export function resolveEffectiveTheme(preference?: ThemePreference): EffectiveTheme {
  const pref = preference ?? getStoredTheme()
  if (pref === 'light' || pref === 'dark') return pref
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export async function resolveStoredEffectiveTheme(): Promise<EffectiveTheme> {
  return resolveEffectiveTheme(await getStoredThemePreference())
}

export const THEME_STORAGE_KEY = STORAGE_KEY

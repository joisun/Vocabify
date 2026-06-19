// https://ui.shadcn.com/docs/dark-mode/vite
import { createContext, useContext, useEffect, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import {
    THEME_STORAGE_KEY,
    getStoredThemePreference,
    resolveEffectiveTheme,
    setStoredThemePreference,
    type ThemePreference,
} from "@/lib/theme"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: ThemePreference
}

type ThemeProviderState = {
    theme: ThemePreference
    setTheme: (theme: ThemePreference) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    ...props
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<ThemePreference>(
        defaultTheme
    )

    useEffect(() => {
        let cancelled = false
        getStoredThemePreference().then((storedTheme) => {
            if (!cancelled) setThemeState(storedTheme)
        })
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")
        root.classList.add(resolveEffectiveTheme(theme))
    }, [theme])

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === THEME_STORAGE_KEY && e.newValue) {
                setThemeState(e.newValue as ThemePreference)
            }
        }
        const onChromeStorage = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
            if (areaName !== 'local') return
            const next = changes[THEME_STORAGE_KEY]?.newValue
            if (next === 'light' || next === 'dark' || next === 'system') {
                setThemeState(next)
            }
        }
        const onMedia = () => {
            if (theme === 'system') {
                const root = window.document.documentElement
                root.classList.remove("light", "dark")
                root.classList.add(resolveEffectiveTheme('system'))
            }
        }
        window.addEventListener('storage', onStorage)
        chrome.storage?.onChanged?.addListener(onChromeStorage)
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        mq.addEventListener('change', onMedia)
        return () => {
            window.removeEventListener('storage', onStorage)
            chrome.storage?.onChanged?.removeListener(onChromeStorage)
            mq.removeEventListener('change', onMedia)
        }
    }, [theme])

    const value = {
        theme,
        setTheme: (next: ThemePreference) => {
            setThemeState(next)
            void setStoredThemePreference(next)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
            <Toaster />
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")
    return context
}

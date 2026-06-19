import * as React from 'react'
import MockLoading from '@/components/custom/MockLoading'
import { Brush, Globe, Key, Languages, Moon, Sun, Wand2, Monitor } from 'lucide-react'
import ApiKeysConfigComponent from './components/ApiKeysConfigComponent'
import PromptTemplate from './components/PromptTemplate'
import TargetLanguageSetting from './components/TargetLanguageSetting'
import UserInterfaceSettings from './components/UserInterfaceSettings'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/custom/theme-provider'
import { cn } from '@/lib/utils'

type SectionId = 'providers' | 'language' | 'prompt' | 'appearance'

const NAV: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'providers', label: 'Providers', icon: Key },
  { id: 'language', label: 'Target language', icon: Languages },
  { id: 'prompt', label: 'Prompt template', icon: Wand2 },
  { id: 'appearance', label: 'Appearance', icon: Brush },
]

function App() {
  const [active, setActive] = React.useState<SectionId>('providers')
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const onScroll = () => {
      const scroller = scrollRef.current
      if (!scroller) return
      const scrollerTop = scroller.getBoundingClientRect().top
      const offsets = NAV.map((nav) => {
        const el = document.getElementById(nav.id)
        if (!el) return { id: nav.id, top: Number.POSITIVE_INFINITY }
        return { id: nav.id, top: Math.abs(el.getBoundingClientRect().top - scrollerTop - 32) }
      })
      const next = offsets.reduce((closest, current) =>
        current.top < closest.top ? current : closest,
      )
      setActive(next.id)
    }
    const scroller = scrollRef.current
    scroller?.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller?.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id: SectionId) {
    const el = document.getElementById(id)
    const scroller = scrollRef.current
    if (!el || !scroller) return
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24
    scroller.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <>
      <MockLoading />
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur dark:border-white/[0.04]">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
            <div className="leading-tight">
              <h1 className="font-display text-[14px] font-semibold tracking-tight">Vocabify</h1>
              <p className="text-[11px] text-muted-foreground">Settings</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <main className="mx-auto flex max-w-5xl gap-8 px-6 py-8 pb-32">
            <aside className="sticky top-6 hidden h-max w-44 shrink-0 self-start md:block">
              <nav className="flex flex-col gap-0.5">
                {NAV.map((nav) => {
                  const Icon = nav.icon
                  const isActive = active === nav.id
                  return (
                    <button
                      key={nav.id}
                      type="button"
                      onClick={() => scrollTo(nav.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {nav.label}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <div className="min-w-0 flex-1 space-y-5">
              <ApiKeysConfigComponent />
              <TargetLanguageSetting />
              <PromptTemplate />
              <UserInterfaceSettings />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const options: Array<{ value: 'light' | 'dark' | 'system'; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]

  return (
    <div className="inline-flex items-center rounded-[6px] border border-border bg-card p-0.5 dark:border-white/[0.04]">
      {options.map((opt) => {
        const Icon = opt.icon
        const isActive = theme === opt.value
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="icon-sm"
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'h-6 w-6 rounded-[4px] text-muted-foreground hover:text-foreground',
              isActive && 'bg-secondary text-foreground',
            )}
          >
            <Icon className="h-3 w-3" />
          </Button>
        )
      })}
    </div>
  )
}

export default App

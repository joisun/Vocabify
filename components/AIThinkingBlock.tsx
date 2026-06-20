import { MeshGradient } from '@paper-design/shaders-react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const CHARACTER_COLORS = ['#FFD9A8', '#F7B267', '#F79D65', '#7DCFB6', '#28536B']

export function AIThinkingBlock({
  active = true,
  label = 'Thinking',
  compact = false,
  showCharacter = true,
  className,
}: {
  active?: boolean
  label?: string
  compact?: boolean
  showCharacter?: boolean
  className?: string
}) {
  if (!active) return null

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-[7px] bg-secondary/35 text-[11px] leading-5 text-muted-foreground dark:bg-white/[0.035]',
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5',
        className,
      )}
      data-testid="vocabify-stream-thinking"
      aria-live="polite"
    >
      {showCharacter && <BunCharacter compact={compact} />}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
        <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/55 animate-ai-pulse" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground/55 animate-ai-pulse [animation-delay:120ms]" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground/55 animate-ai-pulse [animation-delay:240ms]" />
        </span>
      </span>
    </div>
  )
}

export function BunCharacter({ compact, size }: { compact?: boolean; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const resolvedSize = size ?? (compact ? 18 : 22)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const maxOffset = resolvedSize <= 18 ? 1.6 : 2

      setEyeOffset({
        x: clamp((event.clientX - centerX) * 0.045, -maxOffset, maxOffset),
        y: clamp((event.clientY - centerY) * 0.045, -maxOffset, maxOffset),
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [resolvedSize])

  return (
    <div
      ref={ref}
      className="relative shrink-0 text-zinc-950 dark:text-zinc-950"
      style={{ width: resolvedSize, height: resolvedSize }}
      aria-hidden
    >
      <svg viewBox="6 7 52 50" className="h-full w-full overflow-visible drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
        <defs>
          <clipPath id="vocabify-bun-character-clip" clipPathUnits="userSpaceOnUse">
            <path d="M32 7C46.9 7 58 18.1 58 32.4c0 13.5-10.5 24.1-26 24.1S6 45.9 6 32.4C6 18.1 17.1 7 32 7Z" />
          </clipPath>
        </defs>
        <foreignObject x="6" y="7" width="52" height="50" clipPath="url(#vocabify-bun-character-clip)">
          <div className="h-full w-full">
            <MeshGradient
              colors={CHARACTER_COLORS}
              speed={0.9}
              distortion={0.75}
              swirl={0.32}
              className="h-full w-full"
            />
          </div>
        </foreignObject>
        <path
          d="M32 7C46.9 7 58 18.1 58 32.4c0 13.5-10.5 24.1-26 24.1S6 45.9 6 32.4C6 18.1 17.1 7 32 7Z"
          className="fill-transparent stroke-black/10 dark:stroke-white/10"
          strokeWidth="1.5"
        />
        <motion.circle
          r="3.6"
          fill="currentColor"
          animate={{ cx: 24 + eyeOffset.x, cy: 31 + eyeOffset.y }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="vocabify-character-eye"
        />
        <motion.circle
          r="3.6"
          fill="currentColor"
          animate={{ cx: 40 + eyeOffset.x, cy: 31 + eyeOffset.y }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="vocabify-character-eye"
        />
        <path d="M20 18c4-3.2 7.7-4.8 12-4.8S40 14.8 44 18" className="fill-none stroke-white/35" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

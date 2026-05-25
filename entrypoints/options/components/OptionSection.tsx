import { cn } from "@/lib/utils"

/**
 * Apple-style grouped settings section.
 * Renders content inside a card with hairline border and soft shadow.
 */
export default function OptionSection({
  children,
  className,
}: {
  children: React.ReactElement | React.ReactElement[]
  className?: string
}) {
  return (
    <section
      className={cn(
        "vocabify-option-section rounded-2xl border border-border/70 bg-card text-card-foreground shadow-apple-sm",
        "p-6 space-y-3",
        className
      )}
    >
      {children}
    </section>
  )
}

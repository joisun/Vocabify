import { cn } from "@/lib/utils"
import * as React from "react"

interface OptionSectionProps {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function OptionSection({
  id,
  title,
  description,
  children,
  className,
}: OptionSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-[10px] border border-border bg-card text-card-foreground",
        "dark:border-white/8",
        className,
      )}
    >
      {(title || description) ? (
        <header className="border-b border-border px-5 py-3 dark:border-white/8">
          {title ? (
            <h2 className="font-display text-[14px] font-semibold tracking-tight">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  )
}

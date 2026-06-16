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
        "rounded-[10px] bg-card text-card-foreground",
        "ring-1 ring-border/30 dark:ring-white/[0.03]",
        className,
      )}
    >
      {(title || description) ? (
        <header className="px-5 pb-1 pt-4">
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
      <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
    </section>
  )
}

import { cn } from "@/lib/utils"

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
        "vocabify-option-section liquid-card rounded-[24px] p-6 text-card-foreground",
        "space-y-3 shadow-[0_18px_52px_hsl(var(--shadow-color)/0.08),inset_0_1px_0_rgba(255,255,255,0.24)]",
        className
      )}
    >
      {children}
    </section>
  )
}

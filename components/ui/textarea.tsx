import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-[6px] border border-input bg-card px-2.5 py-2 text-[13px] leading-relaxed text-foreground",
        "placeholder:text-muted-foreground",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:border-ring/50",
        "dark:border-white/[0.04] dark:bg-surface dark:focus-visible:ring-white/12 dark:focus-visible:border-white/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

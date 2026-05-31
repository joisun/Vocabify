import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-lg border border-white/[0.28] bg-white/[0.26] px-3 py-2 text-sm leading-relaxed text-foreground",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_hsl(var(--shadow-color)/0.04)] backdrop-blur-xl",
        "placeholder:text-muted-foreground",
        "transition-[box-shadow,border-color,background-color] duration-150 ease-spring",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:border-ring/50 focus-visible:bg-white/[0.44]",
        "dark:border-white/10 dark:bg-white/[0.07] dark:focus-visible:bg-white/[0.12]",
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

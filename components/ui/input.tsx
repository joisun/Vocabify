import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-[6px] border border-input bg-card px-2.5 py-1 text-[13px] text-foreground",
          "placeholder:text-muted-foreground",
          "transition-colors duration-150",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:border-ring/50",
          "dark:border-white/[0.04] dark:bg-surface dark:focus-visible:ring-white/12 dark:focus-visible:border-white/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-white/[0.28] bg-white/[0.26] px-3 py-1 text-sm text-foreground",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_hsl(var(--shadow-color)/0.04)] backdrop-blur-xl",
          "placeholder:text-muted-foreground",
          "transition-[box-shadow,border-color,background-color] duration-150 ease-spring",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:border-ring/50 focus-visible:bg-white/[0.44]",
          "dark:border-white/10 dark:bg-white/[0.07] dark:focus-visible:bg-white/[0.12]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "md:text-sm",
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

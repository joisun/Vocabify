import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Apple-style buttons:
//  - generous tap target (h-9 default, but +2px feel via padding)
//  - subtle 0.96 press feedback
//  - rounded-lg continuous corners
//  - layered shadow on primary surfaces
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium select-none cursor-pointer " +
    "transition-[transform,background-color,box-shadow,color,opacity] duration-150 ease-spring " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-40 " +
    "active:scale-[0.97] " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-white/15 bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.22)] hover:bg-primary/90 hover:shadow-[0_14px_28px_hsl(var(--primary)/0.26)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-apple-sm hover:bg-destructive/90",
        outline:
          "border border-white/[0.24] bg-white/[0.24] backdrop-blur-xl text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/[0.38] dark:border-white/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.14]",
        secondary:
          "border border-white/[0.18] bg-white/[0.20] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl hover:bg-white/[0.32] dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/[0.12]",
        ghost:
          "text-foreground/80 hover:bg-white/[0.16] hover:text-foreground dark:hover:bg-white/[0.10]",
        link:
          "text-primary underline-offset-4 hover:underline px-1",
        // Apple "tinted" / accent button (subtle blue-tinted background)
        tinted:
          "border border-white/[0.18] bg-[linear-gradient(180deg,hsl(var(--accent)/0.92),hsl(var(--accent)/0.74))] text-accent-foreground shadow-[0_10px_22px_hsl(var(--primary)/0.16)] backdrop-blur-xl hover:bg-accent/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

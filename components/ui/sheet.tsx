import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import LiquidGlass from "liquid-glass-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-[radial-gradient(circle_at_72%_18%,hsl(var(--primary)/0.18),transparent_32%),linear-gradient(135deg,hsl(var(--background)/0.50),hsl(var(--background)/0.18))] backdrop-blur-[6px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 text-foreground outline-none transition ease-spring " +
    "data-[state=closed]:duration-300 data-[state=open]:duration-400 " +
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-3 top-3 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top sm:inset-x-4 sm:top-4",
        bottom:
          "inset-x-3 bottom-3 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-4 sm:bottom-4",
        left: "bottom-3 left-3 top-3 w-[calc(100vw-1.5rem)] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:bottom-4 sm:left-4 sm:top-4 sm:w-[min(460px,calc(100vw-2rem))]",
        right:
          "bottom-3 right-3 top-3 w-[calc(100vw-1.5rem)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:bottom-4 sm:right-4 sm:top-4 sm:w-[min(460px,calc(100vw-2rem))]",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal container={getVocabifyPortalContainer()}>
    <SheetOverlay />
    <SheetContentBody
      ref={ref}
      side={side}
      className={className}
      {...props}
    >
      {children}
    </SheetContentBody>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetContentBody = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, onOpenAutoFocus, ...props }, ref) => {
  const contentRef = React.useRef<React.ElementRef<typeof SheetPrimitive.Content>>(null)

  React.useImperativeHandle(ref, () => contentRef.current as React.ElementRef<typeof SheetPrimitive.Content>)
  useShadowDialogA11yMirror(contentRef)

  return (
    <SheetPrimitive.Content
      ref={contentRef}
      className={cn(sheetVariants({ side }), className)}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        contentRef.current?.focus({ preventScroll: true })
      }}
      {...props}
    >
      <LiquidGlassFrame>
        <SheetPrimitive.Close
          className={cn(
            "absolute right-4 top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full",
            "border border-white/30 bg-white/[0.38] text-foreground/70 shadow-apple-xs backdrop-blur-xl hover:bg-white/[0.58] hover:text-foreground",
            "transition-[background-color,color,transform,box-shadow] duration-150 ease-spring active:scale-95",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/16"
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
        {children}
      </LiquidGlassFrame>
    </SheetPrimitive.Content>
  )
})
SheetContentBody.displayName = "SheetContentBody"

function LiquidGlassFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-full min-h-0 w-full overflow-visible rounded-[28px] shadow-[0_24px_80px_hsl(var(--shadow-color)/0.22),0_8px_24px_hsl(var(--shadow-color)/0.12)]"
      data-liquid-glass-frame
    >
      <LiquidGlass
        className="vocabify-liquid-panel"
        displacementScale={38}
        blurAmount={0.045}
        saturation={150}
        aberrationIntensity={1.2}
        elasticity={0.08}
        cornerRadius={28}
        padding="0"
        mode="standard"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "100%",
          height: "100%",
        }}
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden rounded-[28px] border border-white/35 bg-[linear-gradient(145deg,hsl(var(--surface-glass)/0.62),hsl(var(--surface-glass)/0.42))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(255,255,255,0.12)] dark:border-white/10 dark:bg-[linear-gradient(145deg,hsl(var(--surface-glass)/0.76),hsl(var(--surface-glass)/0.50))]">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.42),transparent_32%),radial-gradient(circle_at_92%_18%,hsl(var(--primary)/0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_46%)] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_92%_18%,hsl(var(--primary)/0.20),transparent_38%)]" />
          <div className="relative z-10 flex h-full min-h-0 flex-col">{children}</div>
        </div>
      </LiquidGlass>
    </div>
  )
}

function useShadowDialogA11yMirror(contentRef: React.RefObject<HTMLElement>) {
  React.useLayoutEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const content = contentRef.current
    if (!content || !content.getRootNode || !(content.getRootNode() instanceof ShadowRoot)) return

    const titleId = content.getAttribute("aria-labelledby")
    const descriptionId = content.getAttribute("aria-describedby")
    if (!titleId && !descriptionId) return

    const mirror = document.createElement("div")
    mirror.setAttribute("data-radix-shadow-dialog-a11y-mirror", "")
    mirror.setAttribute("aria-hidden", "true")
    mirror.style.position = "absolute"
    mirror.style.width = "1px"
    mirror.style.height = "1px"
    mirror.style.margin = "-1px"
    mirror.style.padding = "0"
    mirror.style.overflow = "hidden"
    mirror.style.clip = "rect(0 0 0 0)"
    mirror.style.whiteSpace = "nowrap"
    mirror.style.border = "0"

    if (titleId && !document.getElementById(titleId)) {
      const title = document.createElement("h2")
      title.id = titleId
      title.textContent = "Vocabify"
      mirror.appendChild(title)
    }

    if (descriptionId && !document.getElementById(descriptionId)) {
      const description = document.createElement("p")
      description.id = descriptionId
      description.textContent = "Your AI vocabulary library"
      mirror.appendChild(description)
    }

    if (!mirror.childNodes.length) return
    document.body.appendChild(mirror)
    return () => {
      mirror.remove()
    }
  }, [contentRef])
}

function getVocabifyPortalContainer() {
  if (typeof document === "undefined") return undefined
  return (
    document
      .querySelector("#vocabify-root")
      ?.shadowRoot
      ?.querySelector<HTMLElement>("#vocabify-portal-root") || undefined
  )
}

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1 text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn(
      "font-display text-[19px] font-semibold tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

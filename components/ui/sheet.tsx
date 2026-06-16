import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

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
      "fixed inset-0 z-50 bg-transparent",
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
        left: "bottom-3 left-3 top-3 w-[calc(100vw-1.5rem)] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:bottom-4 sm:left-4 sm:top-4 sm:w-[min(340px,calc(100vw-2rem))]",
        right:
          "right-3 top-[20vh] h-[min(60vh,640px)] max-h-[calc(100vh-24px)] w-[calc(100vw-1.5rem)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:right-4 sm:w-[min(340px,calc(100vw-2rem))]",
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

const DRAG_MARGIN = 12

const SheetContentBody = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({
  side = "right",
  className,
  children,
  onOpenAutoFocus,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  style,
  ...props
}, ref) => {
  const contentRef = React.useRef<React.ElementRef<typeof SheetPrimitive.Content>>(null)
  const dragRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    rect: DOMRect
  } | null>(null)
  const [dragFrame, setDragFrame] = React.useState<React.CSSProperties | null>(null)

  React.useImperativeHandle(ref, () => contentRef.current as React.ElementRef<typeof SheetPrimitive.Content>)
  useShadowDialogA11yMirror(contentRef)

  const updateDragFrame = React.useCallback((left: number, top: number, rect: DOMRect) => {
    const maxLeft = Math.max(DRAG_MARGIN, window.innerWidth - rect.width - DRAG_MARGIN)
    const maxTop = Math.max(DRAG_MARGIN, window.innerHeight - rect.height - DRAG_MARGIN)
    setDragFrame({
      bottom: "auto",
      height: rect.height,
      left: clamp(left, DRAG_MARGIN, maxLeft),
      right: "auto",
      top: clamp(top, DRAG_MARGIN, maxTop),
      width: rect.width,
    })
  }, [])

  return (
    <SheetPrimitive.Content
      ref={contentRef}
      className={cn(sheetVariants({ side }), className)}
      style={{ ...style, ...dragFrame }}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        contentRef.current?.focus({ preventScroll: true })
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (event.defaultPrevented || event.button !== 0) return
        const target = event.target as HTMLElement
        if (!target.closest("[data-vocabify-sheet-drag-handle]")) return
        if (target.closest("button,a,input,textarea,select,[role='tab'],[role='combobox']")) return

        const content = contentRef.current
        if (!content) return
        const rect = content.getBoundingClientRect()
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          rect,
        }
        content.setPointerCapture(event.pointerId)
        event.preventDefault()
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        updateDragFrame(
          drag.rect.left + event.clientX - drag.startX,
          drag.rect.top + event.clientY - drag.startY,
          drag.rect,
        )
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const rect = contentRef.current?.getBoundingClientRect()
        dragRef.current = null
        contentRef.current?.releasePointerCapture(event.pointerId)
        if (!rect) return
        const snapLeft = rect.left + rect.width / 2 < window.innerWidth / 2
          ? DRAG_MARGIN
          : window.innerWidth - rect.width - DRAG_MARGIN
        updateDragFrame(snapLeft, rect.top, rect)
      }}
      {...props}
    >
      <VocabifyPanelFrame>{children}</VocabifyPanelFrame>
    </SheetPrimitive.Content>
  )
})
SheetContentBody.displayName = "SheetContentBody"

function VocabifyPanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-[12px] border border-border bg-popover text-popover-foreground dark:border-white/[0.04]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">{children}</div>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
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

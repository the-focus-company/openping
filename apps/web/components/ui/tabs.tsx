"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion, LayoutGroup } from "motion/react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<string>("")

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => {
  const id = React.useId()
  return (
    <TabsContext.Provider value={id}>
      <TabsPrimitive.Root ref={ref} className={className} {...props} />
    </TabsContext.Provider>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const layoutId = React.useContext(TabsContext)
  return (
    <LayoutGroup id={layoutId}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
          className
        )}
        {...props}
      />
    </LayoutGroup>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

// Radix only exposes active state via the data-state DOM attribute,
// so we observe it to conditionally render the motion indicator.
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const layoutId = React.useContext(TabsContext)
  const [isActive, setIsActive] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const mergedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  React.useEffect(() => {
    const node = triggerRef.current
    if (!node) return

    setIsActive(node.getAttribute("data-state") === "active")

    const observer = new MutationObserver(() => {
      setIsActive(node.getAttribute("data-state") === "active")
    })
    observer.observe(node, { attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [])

  return (
    <TabsPrimitive.Trigger
      ref={mergedRef}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {isActive && (
        <motion.span
          layoutId={`${layoutId}-indicator`}
          className="absolute inset-0 rounded-md bg-background shadow"
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          style={{ zIndex: 0 }}
        />
      )}
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

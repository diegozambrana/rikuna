"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SidebarNavItem } from "@/components/layout/SidebarNavItem"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { APP_NAV_ITEMS, type NavItem } from "@/constants/navigation"

function SidebarNavList({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
      {items.map((item) => (
        <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
      ))}
    </nav>
  )
}

export function Sidebar({ items = APP_NAV_ITEMS }: { items?: NavItem[] }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <SidebarNavList items={items} collapsed={collapsed} />
      <div className={cn("flex border-t border-border p-2", collapsed ? "justify-center" : "justify-end")}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>
    </aside>
  )
}

export function SidebarMobileSheet({
  items,
  open,
  onOpenChange,
}: {
  items: NavItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-3/4 gap-0 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Rikuna</SheetTitle>
        </SheetHeader>
        <SidebarNavList items={items} collapsed={false} />
      </SheetContent>
    </Sheet>
  )
}

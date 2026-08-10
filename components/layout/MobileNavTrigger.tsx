"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarMobileSheet } from "@/components/layout/Sidebar"
import { APP_NAV_ITEMS, type NavItem } from "@/constants/navigation"

export function MobileNavTrigger({ items = APP_NAV_ITEMS }: { items?: NavItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </Button>
      <SidebarMobileSheet items={items} open={open} onOpenChange={setOpen} />
    </>
  )
}

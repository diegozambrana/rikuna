"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { MARKETING_NAV_ITEMS } from "@/constants/marketingNavigation"

export function MarketingSidebar() {
  return <Sidebar items={MARKETING_NAV_ITEMS} />
}

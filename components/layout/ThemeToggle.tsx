"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const Icon = isDark ? Sun : Moon

  return (
    <DropdownMenuItem
      onClick={() => setTheme(isDark ? "light" : "dark")}
      closeOnClick={false}
    >
      <Icon />
      Cambiar tema
    </DropdownMenuItem>
  )
}

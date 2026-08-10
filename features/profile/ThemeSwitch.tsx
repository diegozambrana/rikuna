"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const emptySubscribe = () => () => {}

// next-themes only resolves the real theme after mount; rendering
// resolvedTheme directly on first paint mismatches the SSR output
// (this Switch is present in the initial DOM, unlike the avatar
// menu's toggle which only mounts once its dropdown is opened).
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <div className="flex items-center justify-between">
      <Label htmlFor="theme-switch">Modo oscuro</Label>
      <Switch
        id="theme-switch"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      />
    </div>
  )
}

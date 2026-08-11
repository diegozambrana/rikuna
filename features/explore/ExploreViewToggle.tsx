"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ExploreView } from "./view"

const OPTIONS: { view: ExploreView; label: string; Icon: typeof List }[] = [
  { view: "lista", label: "Ver como lista", Icon: List },
  { view: "cuadricula", label: "Ver como cuadrícula", Icon: LayoutGrid },
]

/**
 * Writes the chosen view into the `vista` search param, so it survives a
 * reload and travels with a shared link — same URL-as-state contract as every
 * other Explorar filter.
 */
export function ExploreViewToggle({ current }: { current: ExploreView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function select(view: ExploreView) {
    const params = new URLSearchParams(searchParams.toString())

    // "lista" is the default, so it stays out of the URL rather than pinning a
    // redundant ?vista=lista onto every link.
    if (view === "lista") {
      params.delete("vista")
    } else {
      params.set("vista", view)
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Modo de vista">
      {OPTIONS.map(({ view, label, Icon }) => {
        const active = current === view
        return (
          <Button
            key={view}
            type="button"
            variant={active ? "default" : "outline"}
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => select(view)}
          >
            <Icon />
          </Button>
        )
      })}
    </div>
  )
}

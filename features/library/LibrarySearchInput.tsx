"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"

export function LibrarySearchInput({ currentQuery }: { currentQuery?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(currentQuery ?? "")

  function commit() {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = value.trim()

    if (!trimmed) {
      params.delete("q")
    } else {
      params.set("q", trimmed)
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit()
      }}
      placeholder="Buscar por título…"
      aria-label="Buscar por título"
      className="w-full sm:w-64"
    />
  )
}

"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Text box that writes its value into one search param on blur or Enter,
 * leaving every other param untouched.
 *
 * Committing on blur/Enter rather than on every keystroke is deliberate: each
 * commit is a router.push that re-runs a server query, so per-keystroke
 * navigation would queue a request per character.
 *
 * Shared by /biblioteca and /explorar, which filter different data through
 * the same URL-as-state pattern.
 */
export function SearchParamInput({
  param,
  currentValue,
  placeholder,
  label,
  className,
}: {
  param: string
  currentValue?: string
  placeholder: string
  label: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(currentValue ?? "")

  function commit() {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = value.trim()

    if (!trimmed) {
      params.delete(param)
    } else {
      params.set(param, trimmed)
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
      placeholder={placeholder}
      aria-label={label}
      className={cn("w-full sm:w-64", className)}
    />
  )
}

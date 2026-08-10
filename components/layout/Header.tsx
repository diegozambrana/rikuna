"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MobileNavTrigger } from "@/components/layout/MobileNavTrigger"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { signOut } from "@/actions/auth"
import { MARKETING_NAV_ITEMS } from "@/constants/marketingNavigation"
import type { CurrentUser } from "@/lib/supabase/server"

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function avatarInitials(user: CurrentUser): string {
  if (user.fullName) return initials(user.fullName)
  if (user.email) return user.email[0]!.toUpperCase()
  return "?"
}

export function Header({ user }: { user: CurrentUser | null }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <MobileNavTrigger items={user ? undefined : MARKETING_NAV_ITEMS} />
        <Link
          href={user ? "/panel" : "/"}
          className="font-heading text-sm font-semibold tracking-tight"
        >
          Rikuna
        </Link>
      </div>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar>
              <AvatarFallback>{avatarInitials(user)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate font-medium text-foreground">{user.fullName ?? "Sin nombre"}</span>
                <span className="truncate text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/perfil" />}>Perfil</DropdownMenuItem>
            <ThemeToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="p-0">
              <form action={signOut} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2 px-2 py-2 text-left">
                  <LogOut />
                  Cerrar sesión
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/auth/login" />} nativeButton={false}>
            Iniciar sesión
          </Button>
          <Button size="sm" render={<Link href="/auth/sign-up" />} nativeButton={false}>
            Crear cuenta
          </Button>
        </div>
      )}
    </header>
  )
}

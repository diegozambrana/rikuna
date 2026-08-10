"use client"

import { signOut } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useSession } from "@/hooks/useSession"
import { ThemeSwitch } from "@/features/profile/ThemeSwitch"

export function ProfileScreen() {
  const { user } = useSession()

  if (!user) return null

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <div className="w-full max-w-lg">
        <h1 className="font-heading text-xl font-medium">Perfil</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Datos de tu cuenta, preferencias y sesión.
        </p>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Nombre</Label>
            <p className="text-sm">{user.fullName ?? "Sin nombre"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Correo</Label>
            <p className="text-sm">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSwitch />
        </CardContent>
      </Card>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" variant="destructive">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

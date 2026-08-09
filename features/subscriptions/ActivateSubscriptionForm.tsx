"use client"

import { useActionState } from "react"
import { activateSubscriptionAction } from "@/actions/subscriptions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COUNTRIES } from "@/constants/countries"
import type { Platform } from "@/types"

export function ActivateSubscriptionForm({
  platforms,
}: {
  platforms: Pick<Platform, "id" | "name" | "slug">[]
}) {
  const [state, formAction, pending] = useActionState(activateSubscriptionAction, {
    status: "idle" as const,
  })

  if (platforms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activar suscripción</CardTitle>
          <CardDescription>No hay plataformas configuradas todavía.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activar suscripción</CardTitle>
        <CardDescription>
          Elige la plataforma y el país que pagas actualmente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="platformId">Plataforma</Label>
            <Select name="platformId" required>
              <SelectTrigger id="platformId" className="w-full">
                <SelectValue placeholder="Selecciona una plataforma">
                  {(value: string | null) =>
                    platforms.find((platform) => platform.id === value)?.name ??
                    "Selecciona una plataforma"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">País</Label>
            <Select name="country" required>
              <SelectTrigger id="country" className="w-full">
                <SelectValue placeholder="Selecciona un país">
                  {(value: string | null) =>
                    COUNTRIES.find((country) => country.code === value)?.name ?? "Selecciona un país"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Activando..." : "Activar suscripción"}
          </Button>
        </form>

        {state.status === "error" && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>No se pudo activar la suscripción</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state.status === "success" && (
          <Alert className="mt-4">
            <AlertTitle>Suscripción activada</AlertTitle>
            <AlertDescription>
              Ya puedes ver contenido disponible en esta plataforma y país.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

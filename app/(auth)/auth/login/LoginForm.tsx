"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signIn } from "@/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, { status: "idle" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa a tu cuenta de Rikuna.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Ingresando..." : "Iniciar sesión"}
          </Button>
        </form>
        <div className="mt-4 flex flex-col gap-1 text-xs text-muted-foreground">
          <Link href="/auth/forgot-password" className="hover:text-foreground hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <div>
            ¿No tienes cuenta?{" "}
            <Link href="/auth/sign-up" className="text-foreground hover:underline">
              Regístrate
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

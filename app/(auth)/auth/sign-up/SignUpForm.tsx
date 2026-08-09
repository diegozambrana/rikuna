"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signUp } from "@/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, { status: "idle" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Empieza a organizar qué ver este mes.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "success" ? (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            {state.status === "error" && (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Nombre</Label>
              <Input id="fullName" name="fullName" type="text" required autoComplete="name" />
            </div>
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
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="text-foreground hover:underline">
            Inicia sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import Link from "next/link"
import { useActionState } from "react"
import { forgotPassword } from "@/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPassword, { status: "idle" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace a tu correo.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "success" ? (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Enviando..." : "Enviar enlace"}
            </Button>
          </form>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          <Link href="/auth/login" className="text-foreground hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

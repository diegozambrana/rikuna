import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function EmptySubscriptionState() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Sin suscripción activa</CardTitle>
        <CardDescription>
          Declara qué plataforma de streaming pagas actualmente para ver aquí qué títulos de tu
          lista ya puedes ver.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button render={<Link href="/suscripciones" />} nativeButton={false} className="w-full">
          Configurar mi suscripción
        </Button>
      </CardContent>
    </Card>
  )
}

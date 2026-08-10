import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function EmptyLibraryState() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Tu biblioteca está vacía</CardTitle>
        <CardDescription>
          Importa tu historial de calificaciones y watchlist de IMDb para ver aquí todo lo que
          has visto y lo que quieres ver.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button render={<Link href="/importar" />} nativeButton={false} className="w-full">
          Importar desde IMDb
        </Button>
      </CardContent>
    </Card>
  )
}

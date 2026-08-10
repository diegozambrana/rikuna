import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section id="inicio" className="flex flex-col gap-6 border-b border-border px-6 py-20 sm:px-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Rikuna</h1>
        <p className="text-sm text-muted-foreground">Del quechua, &ldquo;lo que se debe ver&rdquo;.</p>
      </div>
      <p className="max-w-xl text-lg leading-8 text-foreground">
        Tu watchlist de IMDb, cruzada con el streaming que pagas este mes.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" render={<Link href="/auth/sign-up" />} nativeButton={false}>
          Crear cuenta
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/auth/login" />} nativeButton={false}>
          Iniciar sesión
        </Button>
      </div>
    </section>
  )
}

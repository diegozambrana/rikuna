import Link from "next/link"

export function MarketingFooter() {
  return (
    <footer className="flex items-center justify-center gap-6 px-6 py-8 text-sm sm:px-10">
      <Link href="/auth/login" className="text-muted-foreground transition-colors hover:text-foreground">
        Iniciar sesión
      </Link>
      <Link href="/auth/sign-up" className="text-muted-foreground transition-colors hover:text-foreground">
        Crear cuenta
      </Link>
    </footer>
  )
}

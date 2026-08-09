import Link from "next/link"

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="font-heading text-lg font-medium">
          Rikuna
        </Link>
        <Link href="/auth/login" className="text-xs text-muted-foreground hover:text-foreground">
          Iniciar sesión
        </Link>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}

import { getCurrentUser } from "@/lib/supabase/server"
import { signOut } from "@/actions/auth"
import { Button } from "@/components/ui/button"

export default async function PanelPage() {
  const user = await getCurrentUser()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-heading text-xl font-medium">Panel — próximamente</h1>
      <p className="text-sm text-muted-foreground">{user?.email}</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </div>
  )
}

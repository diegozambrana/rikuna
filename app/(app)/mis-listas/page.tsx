import { redirect } from "next/navigation"
import { ListGrid } from "@/features/lists/ListGrid"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"

export default async function MisListasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belt-and-suspenders with the (app) layout guard, same as other routes.
  if (!user) redirect("/auth/login")

  const services = new ListServices(supabase)
  const lists = await services.getUserLists(user.id)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-xl font-medium">Mis listas</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Organiza títulos en tus propias listas y compártelas cuando quieras.
        </p>
      </div>

      <ListGrid lists={lists} />
    </div>
  )
}

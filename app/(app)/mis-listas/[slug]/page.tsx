import { notFound, redirect } from "next/navigation"
import { ListDetail } from "@/features/lists/ListDetail"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"

export default async function MisListaDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const services = new ListServices(supabase)
  const detail = await services.getListBySlug(user.id, slug)

  if (!detail) notFound()

  return <ListDetail list={detail.list} items={detail.items} />
}

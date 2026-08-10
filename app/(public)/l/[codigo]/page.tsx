import { notFound } from "next/navigation"
import { PublicListGrid } from "@/features/lists/public/PublicListGrid"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"

// No generateStaticParams: privacy state and list contents can change at any
// time, so this must always read live, per-request data.
export default async function PublicListPage({ params }: PageProps<"/l/[codigo]">) {
  const { codigo } = await params

  const supabase = await createClient()
  const services = new ListServices(supabase)
  const list = await services.getPublicListByCode(codigo)

  if (!list) notFound()

  return <PublicListGrid list={list} />
}

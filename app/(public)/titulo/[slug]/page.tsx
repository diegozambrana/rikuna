import { notFound } from "next/navigation"
import { getTitleDetail } from "@/actions/media"
import { TitleDetail } from "@/features/title/TitleDetail"

export default async function TituloPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const detail = await getTitleDetail(slug)

  if (!detail) notFound()

  return <TitleDetail slug={slug} detail={detail} />
}

export default async function PublicListPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="font-heading text-xl font-medium">Lista pública — próximamente</h1>
      <p className="text-sm text-muted-foreground">Código: {codigo}</p>
    </div>
  )
}

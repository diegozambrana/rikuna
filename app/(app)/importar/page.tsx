import { UploadForm } from "@/features/import/UploadForm"

export default function ImportarPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <div className="w-full max-w-lg">
        <h1 className="font-heading text-xl font-medium">Importar desde IMDb</h1>
        <ol className="mt-2 list-inside list-decimal text-xs/relaxed text-muted-foreground">
          <li>En IMDb, ve a tu lista de Calificaciones o Watchlist.</li>
          <li>Usa la opción &quot;Export&quot; para descargar el CSV.</li>
          <li>Sube ese archivo aquí y elige el tipo correspondiente.</li>
        </ol>
      </div>
      <UploadForm />
    </div>
  )
}

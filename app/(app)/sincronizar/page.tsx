import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getTmdbSyncStatusAction } from "@/actions/tmdb-sync"
import { Skeleton } from "@/components/ui/skeleton"
import { TmdbSyncScreen } from "@/features/tmdb-sync/TmdbSyncScreen"

export default async function SincronizarPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <div className="w-full max-w-lg">
        <h1 className="font-heading text-xl font-medium">Sincronizar catálogo</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Completa pósters, sinopsis, géneros y reparto de tus títulos usando TMDB.
        </p>
      </div>
      <Suspense fallback={<SyncSkeleton />}>
        <SyncSection />
      </Suspense>
    </div>
  )
}

async function SyncSection() {
  const result = await getTmdbSyncStatusAction()

  if (result.status === "error") {
    // Defensive fallback — /sincronizar is already middleware-protected
    // (lib/supabase/proxy.ts's PROTECTED_PREFIXES), so this only triggers if a
    // session expires between the middleware check and this read.
    redirect("/auth/login")
  }

  return <TmdbSyncScreen counts={result.counts} />
}

function SyncSkeleton() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

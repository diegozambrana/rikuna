import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getAvailabilitySyncStatusAction } from "@/actions/availability-sync"
import { Skeleton } from "@/components/ui/skeleton"
import { AvailabilitySyncScreen } from "@/features/availability-sync/AvailabilitySyncScreen"

export default async function SincronizarDisponibilidadPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <div className="w-full max-w-lg">
        <h1 className="font-heading text-xl font-medium">Sincronizar enlaces</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Busca en TMDB en qué plataformas se puede ver cada título y guarda el enlace para tus
          países.
        </p>
      </div>
      <Suspense fallback={<AvailabilitySkeleton />}>
        <AvailabilitySection />
      </Suspense>
    </div>
  )
}

async function AvailabilitySection() {
  const result = await getAvailabilitySyncStatusAction()

  if (result.status === "error") {
    // Defensive fallback — /sincronizar is already a middleware-protected
    // prefix (lib/supabase/proxy.ts's PROTECTED_PREFIXES uses startsWith, so
    // this nested route is covered), which leaves only the case of a session
    // expiring between that check and this read.
    redirect("/auth/login")
  }

  return (
    <AvailabilitySyncScreen counts={result.counts} platformCount={result.platformCount} />
  )
}

function AvailabilitySkeleton() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

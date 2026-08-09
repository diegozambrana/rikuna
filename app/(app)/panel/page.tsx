import { Suspense } from "react"
import { getMonthlyWatchlist } from "@/actions/recommendations"
import { getActiveSubscriptionsWithPlatformAction } from "@/actions/subscriptions"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptySubscriptionState } from "@/features/panel/EmptySubscriptionState"
import { PanelGrid } from "@/features/panel/PanelGrid"
import type { ActiveSubscriptionWithPlatform } from "@/services"

export default async function PanelPage() {
  const subscriptions = await getActiveSubscriptionsWithPlatformAction()

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptySubscriptionState />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<PanelSkeleton />}>
        <PanelGridSection subscriptions={subscriptions} />
      </Suspense>
    </div>
  )
}

async function PanelGridSection({
  subscriptions,
}: {
  subscriptions: ActiveSubscriptionWithPlatform[]
}) {
  const picks = await getMonthlyWatchlist()
  return <PanelGrid subscriptions={subscriptions} initialPicks={picks} />
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-2/3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

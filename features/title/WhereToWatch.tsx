import { AvailabilityBadge } from "@/components/AvailabilityBadge/AvailabilityBadge"
import type { AvailabilityWithPlatform } from "@/services"
import type { UserSubscription } from "@/types"

export function WhereToWatch({
  availability,
  activeSubscriptions,
}: {
  availability: AvailabilityWithPlatform[]
  activeSubscriptions: UserSubscription[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium text-muted-foreground">Dónde ver</h2>
      {availability.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin disponibilidad confirmada por ahora.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {availability.map((row) => {
            const isActiveSubscription = activeSubscriptions.some(
              (sub) => sub.platformId === row.platform.id && sub.country === row.country
            )

            return (
              <AvailabilityBadge
                key={row.id}
                platform={row.platform}
                isActiveSubscription={isActiveSubscription}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

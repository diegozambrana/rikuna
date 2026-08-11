import { AvailabilityBadge } from "@/components/AvailabilityBadge/AvailabilityBadge"
import type { AvailabilityWithPlatform } from "@/services"
import type { UserSubscription } from "@/types"
import { groupAvailability } from "./groupAvailability"

export function WhereToWatch({
  availability,
  activeSubscriptions,
}: {
  availability: AvailabilityWithPlatform[]
  activeSubscriptions: UserSubscription[]
}) {
  const entries = groupAvailability(availability, activeSubscriptions)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium text-muted-foreground">Dónde ver</h2>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin disponibilidad confirmada por ahora.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
              <AvailabilityBadge
                key={entry.key}
                // The link lives on the availability row, not on the platform:
                // the same platform has a different watch page per country.
                platform={{
                  name: entry.platform.name,
                  slug: entry.platform.slug,
                  url: entry.url,
                }}
                isActiveSubscription={entry.isActiveSubscription}
                note={entry.note}
              />
            ))}
          </div>
          {/* Required by TMDB's terms of use for the watch providers data. */}
          <p className="text-[10px] text-muted-foreground">
            Datos de disponibilidad por JustWatch, vía TMDB.
          </p>
        </>
      )}
    </div>
  )
}

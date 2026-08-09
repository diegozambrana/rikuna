import { Badge } from "@/components/ui/badge"
import { COUNTRIES } from "@/constants/countries"
import type { ActiveSubscriptionWithPlatform } from "@/services"

function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code
}

function counterCopy(count: number) {
  const noun = count === 1 ? "título" : "títulos"
  const verb = count === 1 ? "disponible" : "disponibles"
  return `${count} ${noun} de tu lista ${verb} ahora`
}

export function PanelHeader({
  subscriptions,
  count,
}: {
  subscriptions: ActiveSubscriptionWithPlatform[]
  count: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {subscriptions.map((subscription) => (
          <Badge key={subscription.id} variant="outline">
            {subscription.platformName} · {countryName(subscription.country)}
          </Badge>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{counterCopy(count)}</p>
    </div>
  )
}

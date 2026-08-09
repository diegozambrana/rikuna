import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { COUNTRIES } from "@/constants/countries"
import type { Platform, UserSubscription } from "@/types"

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" })

function platformName(platforms: Pick<Platform, "id" | "name">[], platformId: string) {
  return platforms.find((p) => p.id === platformId)?.name ?? "Plataforma desconocida"
}

function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code
}

export function ActiveSubscriptionsList({
  subscriptions,
  platforms,
}: {
  subscriptions: UserSubscription[]
  platforms: Pick<Platform, "id" | "name" | "slug">[]
}) {
  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Todavía no tienes ninguna suscripción activa.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {subscriptions.map((subscription) => (
        <Card key={subscription.id}>
          <CardHeader>
            <CardTitle>{platformName(platforms, subscription.platformId)}</CardTitle>
            <CardDescription>{countryName(subscription.country)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Activa desde {dateFormatter.format(new Date(subscription.startedOn))}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

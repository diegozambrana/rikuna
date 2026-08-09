import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { COUNTRIES } from "@/constants/countries"
import type { Platform, UserSubscription } from "@/types"

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" })

function platformName(platforms: Pick<Platform, "id" | "name">[], platformId: string) {
  return platforms.find((p) => p.id === platformId)?.name ?? "Plataforma desconocida"
}

function countryName(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code
}

export function SubscriptionHistoryTable({
  history,
  platforms,
}: {
  history: UserSubscription[]
  platforms: Pick<Platform, "id" | "name" | "slug">[]
}) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Todavía no tienes historial de suscripciones.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plataforma</TableHead>
          <TableHead>País</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead>Hasta</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((subscription) => (
          <TableRow key={subscription.id}>
            <TableCell className="font-medium">
              {platformName(platforms, subscription.platformId)}
            </TableCell>
            <TableCell>{countryName(subscription.country)}</TableCell>
            <TableCell>{dateFormatter.format(new Date(subscription.startedOn))}</TableCell>
            <TableCell>
              {subscription.endedOn ? dateFormatter.format(new Date(subscription.endedOn)) : "—"}
            </TableCell>
            <TableCell>
              {subscription.endedOn ? (
                <Badge variant="outline">Finalizada</Badge>
              ) : (
                <Badge>Activa</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

import {
  getActiveSubscriptionsAction,
  getKnownPlatformsAction,
  getSubscriptionHistoryAction,
} from "@/actions/subscriptions"
import { ActivateSubscriptionForm } from "@/features/subscriptions/ActivateSubscriptionForm"
import { ActiveSubscriptionsList } from "@/features/subscriptions/ActiveSubscriptionsList"
import { SubscriptionHistoryTable } from "@/features/subscriptions/SubscriptionHistoryTable"

export default async function SuscripcionesPage() {
  const [activeSubscriptions, history, platforms] = await Promise.all([
    getActiveSubscriptionsAction(),
    getSubscriptionHistoryAction(),
    getKnownPlatformsAction(),
  ])

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <div className="w-full max-w-lg">
        <h1 className="font-heading text-xl font-medium">Mis suscripciones</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Declara qué plataformas y país pagas actualmente para saber qué puedes ver ahora.
        </p>
      </div>

      <div className="w-full max-w-lg">
        <h2 className="font-heading text-sm font-medium">Activas</h2>
        <div className="mt-2">
          <ActiveSubscriptionsList subscriptions={activeSubscriptions} platforms={platforms} />
        </div>
      </div>

      <div className="w-full max-w-lg">
        <ActivateSubscriptionForm platforms={platforms} />
      </div>

      <div className="w-full max-w-lg">
        <h2 className="font-heading text-sm font-medium">Historial</h2>
        <div className="mt-2">
          <SubscriptionHistoryTable history={history} platforms={platforms} />
        </div>
      </div>
    </div>
  )
}

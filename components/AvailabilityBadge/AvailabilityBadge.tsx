import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Shared across the ficha (RIK-9) and, later, panel/recommendations
// (RIK-7/RIK-8) — no title-page-specific coupling: callers pass just the
// platform fields they have plus whether it matches an active subscription.
export type AvailabilityBadgePlatform = {
  name: string
  slug: string
  url?: string | null
}

export function AvailabilityBadge({
  platform,
  isActiveSubscription,
  note,
  className,
}: {
  platform: AvailabilityBadgePlatform
  isActiveSubscription: boolean
  /** Qualifier for the offer this badge stands for: "Alquiler", "AR · Compra"… */
  note?: string | null
  className?: string
}) {
  return (
    <Badge
      variant={isActiveSubscription ? "default" : "outline"}
      render={
        platform.url ? (
          <a
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver ${platform.name} (se abre en una pestaña nueva)`}
          />
        ) : undefined
      }
      className={cn(
        "h-7 gap-1.5 px-2.5 text-sm",
        platform.url && "cursor-pointer hover:opacity-80",
        className
      )}
    >
      {platform.name}
      {isActiveSubscription && (
        <span className="font-mono text-[10px] font-semibold tracking-wide uppercase opacity-90">
          Tu servicio
        </span>
      )}
      {note && (
        <span className="font-mono text-[10px] font-normal tracking-wide uppercase opacity-70">
          {note}
        </span>
      )}
    </Badge>
  )
}

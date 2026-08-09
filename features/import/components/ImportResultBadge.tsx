import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import type { ImdbImportRowResult } from "@/types"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const RESULT_CONFIG: Record<ImdbImportRowResult, { label: string; variant: BadgeVariant }> = {
  matched: { label: "Reconocido", variant: "secondary" },
  created: { label: "Creado", variant: "default" },
  skipped: { label: "Omitido", variant: "destructive" },
  pending: { label: "Pendiente", variant: "outline" },
}

export function ImportResultBadge({ result }: { result: ImdbImportRowResult }) {
  const config = RESULT_CONFIG[result] ?? RESULT_CONFIG.pending
  return <Badge variant={config.variant}>{config.label}</Badge>
}

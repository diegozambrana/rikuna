// Curated ISO-3166 alpha-2 list for the subscription country picker.
// Not a full i18n country list — extend as Rikuna's target markets grow.
export type Country = {
  code: string
  name: string
}

export const COUNTRIES: Country[] = [
  { code: "BO", name: "Bolivia" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
]

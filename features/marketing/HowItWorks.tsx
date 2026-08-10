import { Upload, Tv, ListChecks, Sparkles, type LucideIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type Step = {
  title: string
  description: string
  icon: LucideIcon
}

const STEPS: Step[] = [
  {
    title: "Importa tu historial de IMDb",
    description: "Sube tu CSV de calificaciones y lista de seguimiento — así sabemos qué ya viste.",
    icon: Upload,
  },
  {
    title: "Indica tu servicio activo",
    description: "Dinos qué plataforma y país pagas este mes.",
    icon: Tv,
  },
  {
    title: "Recibe tu lista del mes",
    description: "Vemos qué de tu watchlist está disponible ahora en tu servicio.",
    icon: ListChecks,
  },
  {
    title: "Descubre algo nuevo",
    description: "Te sugerimos títulos bien calificados que aún no has visto.",
    icon: Sparkles,
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="flex flex-col gap-8 border-b border-border px-6 py-16 sm:px-10">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">Cómo funciona</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <Card key={step.title}>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

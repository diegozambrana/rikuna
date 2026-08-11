import {
  Home,
  Sparkles,
  Library,
  ListVideo,
  Tv,
  Upload,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const APP_NAV_ITEMS: NavItem[] = [
  { label: "Qué ver este mes", href: "/panel", icon: Home },
  { label: "Recomendaciones", href: "/recomendaciones", icon: Sparkles },
  { label: "Mi biblioteca", href: "/biblioteca", icon: Library },
  { label: "Mis listas", href: "/mis-listas", icon: ListVideo },
  { label: "Mis suscripciones", href: "/suscripciones", icon: Tv },
  { label: "Importar desde IMDb", href: "/importar", icon: Upload },
  { label: "Sincronizar catálogo", href: "/sincronizar", icon: RefreshCw },
]

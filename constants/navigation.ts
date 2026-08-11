import {
  Home,
  Compass,
  Sparkles,
  Library,
  Link2,
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
  /**
   * Highlight this item only on an exact path match. Needed for any href that
   * is a prefix of another item's — without it, SidebarNavItem's startsWith
   * check lights up both the parent and the child.
   */
  exact?: boolean
}

export const APP_NAV_ITEMS: NavItem[] = [
  { label: "Qué ver este mes", href: "/panel", icon: Home },
  { label: "Recomendaciones", href: "/recomendaciones", icon: Sparkles },
  { label: "Explorar", href: "/explorar", icon: Compass },
  { label: "Mi biblioteca", href: "/biblioteca", icon: Library },
  { label: "Mis listas", href: "/mis-listas", icon: ListVideo },
  { label: "Mis suscripciones", href: "/suscripciones", icon: Tv },
  { label: "Importar desde IMDb", href: "/importar", icon: Upload },
  { label: "Sincronizar catálogo", href: "/sincronizar", icon: RefreshCw, exact: true },
  { label: "Sincronizar enlaces", href: "/sincronizar/disponibilidad", icon: Link2 },
]

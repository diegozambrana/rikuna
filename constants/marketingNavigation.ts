import { Home, HelpCircle, LogIn, UserPlus } from "lucide-react"
import type { NavItem } from "@/constants/navigation"

export const MARKETING_NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "#inicio", icon: Home },
  { label: "Cómo funciona", href: "#como-funciona", icon: HelpCircle },
  { label: "Iniciar sesión", href: "/auth/login", icon: LogIn },
  { label: "Crear cuenta", href: "/auth/sign-up", icon: UserPlus },
]

import { useUserContext } from "@/components/providers/UserProvider"

export function useSession() {
  const user = useUserContext()

  return { user, isAuthenticated: user !== null }
}

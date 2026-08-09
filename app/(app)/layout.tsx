import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { UserProvider } from "@/components/providers/UserProvider"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()

  // Belt-and-suspenders with the proxy-level check: Server Functions bypass
  // proxy matchers, so this Server Component check is the real backstop.
  if (!user) {
    redirect("/auth/login")
  }

  return <UserProvider user={user}>{children}</UserProvider>
}

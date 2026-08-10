import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { UserProvider } from "@/components/providers/UserProvider"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()

  // Belt-and-suspenders with the proxy-level check: Server Functions bypass
  // proxy matchers, so this Server Component check is the real backstop.
  if (!user) {
    redirect("/auth/login")
  }

  return (
    <UserProvider user={user}>
      <div className="flex h-full min-h-svh flex-col">
        <Header user={user} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </UserProvider>
  )
}

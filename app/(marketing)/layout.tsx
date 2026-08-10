import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { Header } from "@/components/layout/Header"
import { MarketingSidebar } from "@/components/layout/MarketingSidebar"

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()

  // Belt-and-suspenders with the proxy-level check: Server Functions bypass
  // proxy matchers, so this Server Component check is the real backstop.
  if (user) {
    redirect("/panel")
  }

  return (
    <div className="flex h-full min-h-svh flex-col">
      <Header user={null} />
      <div className="flex flex-1 overflow-hidden">
        <MarketingSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

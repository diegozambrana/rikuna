import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { LoginForm } from "./LoginForm"

export default async function LoginPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/panel")
  }

  return <LoginForm />
}

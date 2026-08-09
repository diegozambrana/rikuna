import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { SignUpForm } from "./SignUpForm"

export default async function SignUpPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/panel")
  }

  return <SignUpForm />
}

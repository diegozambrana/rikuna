"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { AuthActionState } from "./types"

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { status: "error", message: error.message }
  }

  redirect("/panel")
}

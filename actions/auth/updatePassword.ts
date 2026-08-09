"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { AuthActionState } from "./types"

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (password !== confirmPassword) {
    return { status: "error", message: "Las contraseñas no coinciden." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { status: "error", message: error.message }
  }

  redirect("/panel")
}

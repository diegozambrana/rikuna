"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import type { AuthActionState } from "./types"

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = formData.get("fullName") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (password !== confirmPassword) {
    return { status: "error", message: "Las contraseñas no coinciden." }
  }

  const origin = (await headers()).get("origin")
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  if (error) {
    return { status: "error", message: error.message }
  }

  return {
    status: "success",
    message: "Revisa tu correo para confirmar tu cuenta.",
  }
}

"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import type { AuthActionState } from "./types"

export async function forgotPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email") as string

  const origin = (await headers()).get("origin")
  const supabase = await createClient()

  // Always return a success-shaped state regardless of whether the email
  // exists — standard practice, do not leak account existence.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?type=recovery`,
  })

  return {
    status: "success",
    message: "Si el correo existe, te enviamos un enlace de recuperación.",
  }
}

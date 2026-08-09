import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")

  const supabase = await createClient()

  // This @supabase/ssr client defaults to the PKCE flow, so email links
  // (recovery included) arrive with `code`, not `token_hash` — handle both.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectPath = type === "recovery" ? "/auth/update-password" : "/panel"
      return NextResponse.redirect(new URL(redirectPath, origin))
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      const redirectPath = type === "recovery" ? "/auth/update-password" : "/panel"
      return NextResponse.redirect(new URL(redirectPath, origin))
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=confirm_failed", origin))
}

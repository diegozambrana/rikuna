// This layout must NOT redirect authenticated users away as a blanket rule:
// /auth/update-password relies on the authenticated recovery session created by
// /auth/confirm to let the user set a new password. The "redirect if already
// logged in" check (AC-4) only applies to /auth/login and /auth/sign-up, so it
// lives in those two pages instead of here.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center p-6">
      <div className="mb-6 font-heading text-lg font-medium">Rikuna</div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

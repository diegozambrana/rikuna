export type AuthActionState = {
  status: "idle" | "error" | "success"
  message?: string
}

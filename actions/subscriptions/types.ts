import type { UserSubscription } from "@/types"

export type ActivateSubscriptionActionState =
  | { status: "idle" }
  | { status: "success"; subscription: UserSubscription }
  | { status: "error"; message: string }

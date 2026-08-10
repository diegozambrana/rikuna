import type { UserList } from "@/types"

export type ListFormActionState =
  | { status: "idle" }
  | { status: "success"; list: UserList }
  | { status: "error"; message: string }

export type ListMutationResult = { success: boolean; error?: string; publicCode?: string | null }

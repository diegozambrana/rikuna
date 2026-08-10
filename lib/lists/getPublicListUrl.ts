import type { UserList } from "@/types"

/**
 * TODO(RIK-11): user_lists.slug is unique only per-user, not globally, so it
 * cannot back a public share link on its own — RIK-11 owns adding a separate
 * globally-unique short code and implementing this function's body. Until
 * then this always returns null, regardless of list.isPublic, and callers
 * (the "Copiar enlace" button) must treat null as "not available yet".
 */
export function getPublicListUrl(list: UserList): string | null {
  void list
  return null
}

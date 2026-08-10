import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generatePublicListCode } from "@/lib/lists/getPublicListUrl"
import { slugify, withSlugRetry } from "@/lib/slug"
import type { ListItem, UserList } from "@/types"

type UserListRow = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  name: string
  slug: string
  description: string | null
  is_public: boolean
  public_code: string | null
}

function mapUserListRow(row: UserListRow): UserList {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isPublic: row.is_public,
    publicCode: row.public_code,
  }
}

// Read shape for the /mis-listas grid — item count computed via PostgREST's
// embedded count aggregate rather than a stored column.
export type ListWithItemCount = UserList & { itemCount: number }

// Poster-card projection for a list_items row joined to its media_items,
// shaped for MediaCard rendering on /mis-listas/[slug] — narrower than the
// full MediaItem since the grid only needs poster/title/year/rating.
export type ListItemMedia = {
  id: string
  slug: string
  title: string
  year: number | null
  posterUrl: string | null
  imdbRating: number | null
  isStub: boolean
}

export type ListItemWithMedia = Pick<ListItem, "id" | "mediaId" | "sortOrder" | "note"> & {
  media: ListItemMedia
}

export type ListWithItems = { list: UserList; items: ListItemWithMedia[] }

// For AddToListDialog — one row per the caller's own list, plus whether
// mediaId already belongs to it.
export type ListWithContainsFlag = Pick<UserList, "id" | "name" | "slug" | "isPublic"> & {
  containsMedia: boolean
}

// Read shape for /l/[codigo] — deliberately excludes slug (never the public
// identifier, schema doc Section 11.6) and anything from user_subscriptions /
// user_media_status / other lists of the same owner (PRD Section 11 privacy
// rule).
export type PublicListView = {
  id: string
  name: string
  description: string | null
  publicCode: string
  items: ListItemMedia[]
}

const UNIQUE_VIOLATION = "23505"

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  )
}

function mapListItemMediaRow(row: {
  id: string
  slug: string
  title: string
  year: number | null
  poster_url: string | null
  imdb_rating: number | null
  is_stub: boolean
}): ListItemMedia {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    year: row.year,
    posterUrl: row.poster_url,
    imdbRating: row.imdb_rating,
    isStub: row.is_stub,
  }
}

export class ListServices {
  constructor(private readonly client: SupabaseClient) {}

  /** All of the caller's own lists with an item count, newest first. */
  async getUserLists(userId: string): Promise<ListWithItemCount[]> {
    const { data, error } = await this.client
      .from("user_lists")
      .select("*, list_items(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return (data as (UserListRow & { list_items: { count: number }[] })[]).map((row) => ({
      ...mapUserListRow(row),
      itemCount: row.list_items[0]?.count ?? 0,
    }))
  }

  /**
   * One owned list plus its items joined to media_items, ordered by
   * sort_order. Filters by user_id explicitly (not just RLS) so a public
   * list belonging to someone else never resolves on this owner-only route.
   */
  async getListBySlug(userId: string, slug: string): Promise<ListWithItems | null> {
    const { data, error } = await this.client
      .from("user_lists")
      .select(
        `*,
        list_items(id, media_id, sort_order, note,
          media_items(id, slug, title, year, poster_url, imdb_rating, is_stub))`
      )
      .eq("user_id", userId)
      .eq("slug", slug)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as UserListRow & {
      list_items: {
        id: string
        media_id: string
        sort_order: number
        note: string | null
        media_items: Parameters<typeof mapListItemMediaRow>[0] | null
      }[]
    }

    const items = (row.list_items ?? [])
      .filter((item) => item.media_items !== null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        mediaId: item.media_id,
        sortOrder: item.sort_order,
        note: item.note,
        media: mapListItemMediaRow(item.media_items!),
      }))

    return { list: mapUserListRow(row), items }
  }

  /** Generates a kebab-case slug from name; retries with a numeric suffix on collision. */
  async createList(
    userId: string,
    input: { name: string; description?: string | null }
  ): Promise<UserList> {
    const baseSlug = slugify(input.name)

    const created = await withSlugRetry(baseSlug, async (slug) => {
      const { data, error } = await this.client
        .from("user_lists")
        .insert({
          user_id: userId,
          name: input.name,
          slug,
          description: input.description ?? null,
        })
        .select("*")
        .single()

      if (error) throw error
      return data as UserListRow
    })

    return mapUserListRow(created)
  }

  /** Updates name/description only — never touches slug. */
  async renameList(id: string, input: { name: string; description?: string | null }): Promise<UserList> {
    const { data, error } = await this.client
      .from("user_lists")
      .update({ name: input.name, description: input.description ?? null })
      .eq("id", id)
      .select("*")
      .single()

    if (error) throw error
    return mapUserListRow(data as UserListRow)
  }

  /** Relies on ON DELETE CASCADE for list_items — no explicit cleanup needed. */
  async deleteList(id: string): Promise<void> {
    const { error } = await this.client.from("user_lists").delete().eq("id", id)
    if (error) throw error
  }

  /** Inserts at sort_order = current max + 1. Treats the unique-violation (already in list) as a no-op success. */
  async addListItem(listId: string, mediaId: string): Promise<void> {
    const { data: maxRow, error: maxError } = await this.client
      .from("list_items")
      .select("sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxError) throw maxError

    const nextSortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1

    const { error } = await this.client
      .from("list_items")
      .insert({ list_id: listId, media_id: mediaId, sort_order: nextSortOrder })

    if (error && !isUniqueViolation(error)) throw error
  }

  async removeListItem(listId: string, mediaId: string): Promise<void> {
    const { error } = await this.client
      .from("list_items")
      .delete()
      .eq("list_id", listId)
      .eq("media_id", mediaId)

    if (error) throw error
  }

  /** Upserts sort_order for every row in one call, matched on list_items_uq (list_id, media_id). */
  async reorderListItems(listId: string, orderedMediaIds: string[]): Promise<void> {
    const rows = orderedMediaIds.map((mediaId, index) => ({
      list_id: listId,
      media_id: mediaId,
      sort_order: index,
    }))

    const { error } = await this.client
      .from("list_items")
      .upsert(rows, { onConflict: "list_id,media_id" })

    if (error) throw error
  }

  /**
   * Toggles visibility. `.select("*").single()` doubles as the ownership
   * check: RLS's user_lists_update policy scopes the UPDATE to the caller's
   * own rows, so a non-owner's attempt matches zero rows and .single() throws
   * — no separate "if not owner" check needed.
   *
   * On the false -> true transition, a list with no public_code yet is
   * assigned one, retrying up to 5 times on a Postgres unique-violation
   * (23505) rather than assuming the random code can never collide. A list
   * that already has a code (previously published, then made private) keeps
   * it — public_code is stable for the list's lifetime once first assigned.
   */
  async setListVisibility(listId: string, isPublic: boolean): Promise<UserList> {
    if (!isPublic) {
      const { data, error } = await this.client
        .from("user_lists")
        .update({ is_public: false })
        .eq("id", listId)
        .select("*")
        .single()

      if (error) throw error
      return mapUserListRow(data as UserListRow)
    }

    const { data: current, error: fetchError } = await this.client
      .from("user_lists")
      .select("public_code")
      .eq("id", listId)
      .single()

    if (fetchError) throw fetchError

    const existingCode = (current as { public_code: string | null }).public_code

    if (existingCode) {
      const { data, error } = await this.client
        .from("user_lists")
        .update({ is_public: true })
        .eq("id", listId)
        .select("*")
        .single()

      if (error) throw error
      return mapUserListRow(data as UserListRow)
    }

    const maxAttempts = 5
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await this.client
        .from("user_lists")
        .update({ is_public: true, public_code: generatePublicListCode() })
        .eq("id", listId)
        .select("*")
        .single()

      if (!error) return mapUserListRow(data as UserListRow)
      if (!isUniqueViolation(error)) throw error
      lastError = error
    }

    throw lastError
  }

  /**
   * Public read for /l/[codigo] — explicit column list, no wildcard, joined
   * only to list_items -> media_items (never user_subscriptions or
   * user_media_status). RLS on user_lists (is_public or owner) already
   * reduces this to zero rows for a private list under the anon role, so a
   * null return means either "no such code" or "not public" — the caller
   * can't distinguish them, which is the point (no information leak).
   */
  async getPublicListByCode(code: string): Promise<PublicListView | null> {
    const { data, error } = await this.client
      .from("user_lists")
      .select(
        `id, name, description, public_code,
        list_items(sort_order,
          media_items(id, slug, title, year, poster_url, imdb_rating, is_stub))`
      )
      .eq("public_code", code)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as unknown as {
      id: string
      name: string
      description: string | null
      public_code: string
      list_items: {
        sort_order: number
        media_items: Parameters<typeof mapListItemMediaRow>[0] | null
      }[]
    }

    const items = (row.list_items ?? [])
      .filter((item) => item.media_items !== null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => mapListItemMediaRow(item.media_items!))

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      publicCode: row.public_code,
      items,
    }
  }

  /**
   * The caller's lists plus whether mediaId is already in each, in one
   * query: list_items is embedded pre-filtered to mediaId, so a non-empty
   * embedded array means "already in this list".
   */
  async getListsContainingMedia(userId: string, mediaId: string): Promise<ListWithContainsFlag[]> {
    const { data, error } = await this.client
      .from("user_lists")
      .select("id, name, slug, is_public, list_items(media_id)")
      .eq("user_id", userId)
      .eq("list_items.media_id", mediaId)
      .order("name", { ascending: true })

    if (error) throw error

    return (
      data as (Pick<UserListRow, "id" | "name" | "slug" | "is_public"> & {
        list_items: { media_id: string }[]
      })[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isPublic: row.is_public,
      containsMedia: row.list_items.length > 0,
    }))
  }
}

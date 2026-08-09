import type { SupabaseClient } from "@supabase/supabase-js"
import type { ActivateSubscriptionInput, Platform, UserSubscription } from "@/types"

type UserSubscriptionRow = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  platform_id: string
  country: string
  started_on: string
  ended_on: string | null
  notes: string | null
}

function mapRow(row: UserSubscriptionRow): UserSubscription {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    platformId: row.platform_id,
    country: row.country,
    startedOn: row.started_on,
    endedOn: row.ended_on,
    notes: row.notes,
  }
}

const UNIQUE_VIOLATION = "23505"

export class SubscriptionServices {
  constructor(private readonly client: SupabaseClient) {}

  async getActiveSubscriptions(userId: string): Promise<UserSubscription[]> {
    const { data, error } = await this.client
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .is("ended_on", null)

    if (error) throw error
    return (data as UserSubscriptionRow[]).map(mapRow)
  }

  async getSubscriptionHistory(userId: string): Promise<UserSubscription[]> {
    const { data, error } = await this.client
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("started_on", { ascending: false })

    if (error) throw error
    return (data as UserSubscriptionRow[]).map(mapRow)
  }

  async activateSubscription(
    userId: string,
    input: ActivateSubscriptionInput
  ): Promise<UserSubscription> {
    const today = new Date().toISOString().slice(0, 10)

    const { error: closeError } = await this.client
      .from("user_subscriptions")
      .update({ ended_on: today })
      .eq("user_id", userId)
      .eq("platform_id", input.platformId)
      .eq("country", input.country)
      .is("ended_on", null)

    if (closeError) throw closeError

    const { data, error: insertError } = await this.client
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        platform_id: input.platformId,
        country: input.country,
        notes: input.notes ?? null,
      })
      .select("*")
      .single()

    if (insertError) {
      if (insertError.code === UNIQUE_VIOLATION) {
        throw new Error(
          "Ya existe una suscripción activa para esa plataforma y país. Intenta de nuevo."
        )
      }
      throw insertError
    }

    return mapRow(data as UserSubscriptionRow)
  }

  async getKnownPlatforms(): Promise<Pick<Platform, "id" | "name" | "slug">[]> {
    const { data, error } = await this.client
      .from("platforms")
      .select("id, name, slug")
      .order("name", { ascending: true })

    if (error) throw error
    return data as Pick<Platform, "id" | "name" | "slug">[]
  }
}

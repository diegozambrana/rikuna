/**
 * 10-character URL-safe code for /l/[codigo]. Derived from crypto.randomUUID()
 * (CSPRNG) rather than user_lists.slug, which is unique only per-user and
 * explicitly unfit as a public identifier (schema doc Section 11.6).
 * Collisions are handled by the caller retrying on the DB's unique-violation,
 * not by checking uniqueness here.
 */
export function generatePublicListCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10)
}

export function getPublicListUrl(publicCode: string | null): string | null {
  return publicCode ? `/l/${publicCode}` : null
}

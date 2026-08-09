// media_items.slug is unique and not null, but the IMDb CSV never provides
// one — it is generated here and the DB's unique constraint is the source of
// truth for collisions (no pre-query), so callers retry with a disambiguating
// suffix instead of checking uniqueness up front.

const POSTGRES_UNIQUE_VIOLATION = "23505"

export function slugify(title: string, year?: number | null): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return year ? `${base}-${year}` : base
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  )
}

/**
 * Runs `attemptInsert` with `baseSlug`, and on a Postgres unique_violation
 * retries with `-2`, `-3`, ... suffixes up to `maxAttempts` times.
 */
export async function withSlugRetry<T>(
  baseSlug: string,
  attemptInsert: (slug: string) => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`

    try {
      return await attemptInsert(slug)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      lastError = error
    }
  }

  throw lastError
}

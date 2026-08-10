# RIK-14 — Mi biblioteca

## Ticket summary

Build `/biblioteca`, the screen for exploring and managing a user's entire personal watch history — every title they've marked watched, want-to-watch, or otherwise touched, whether imported from IMDb or set manually. Three tabs (Vistas / Quiero ver / Todas), filters (type, genre, year, rating, availability on the active subscription), a title search box, and a dense `DataTable` result — all server-filtered via URL search params so results stay shareable/bookmarkable and paginated client-side.

- No new schema: everything reads from `user_media_status` (already the sole source of "watched"/"want to watch"/"dismissed") joined to `media_items`, `genres`, and (for the availability filter) `media_availability` + `user_subscriptions` — all tables RIK-1/RIK-3/RIK-4/RIK-9 already populate.
- `services/MediaServices/index.ts` already has a code comment flagging this exact gap: *"No established search method existed yet for RIK-3/RIK-9 to reuse (biblioteca's search ships in a later ticket)."* This ticket is that later ticket.
- Empty state: no `user_media_status` rows at all for the user → invite to `/importar`, per the PRD.
- No team comments — derived from the same gap-analysis pass as RIK-12/RIK-13. Font family / typography is explicitly out of scope per the requester.

---

## Context

### Original ticket

No tracker ticket exists for this work; scoped from a direct comparison between `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` Section 2.2 ("`/biblioteca` — Mi biblioteca") and the real repository — confirmed via `find`/`grep` that no `app/(app)/biblioteca/`, `features/library/`, or biblioteca-scoped service method exists anywhere.

PRD requirements folded in here (Section 2.2, verbatim intent):

- **Purpose:** explore and manage the entire personal history.
- **Content:** `Tabs` — "Vistas" / "Quiero ver" / "Todas". A filter bar (type, genre, year, rating range, availability on the active service) and a title search box. Table or grid with the results.
- **Suggested components:** `Tabs`, search `Input`, `Select`/`Popover` filters, `DataTable` or a `Card` grid — PRD explicitly favors `DataTable` for a large library ("para una biblioteca grande, DataTable es más eficiente").
- **States:** empty library → message inviting the user to import from IMDb.

### Team comments

None — see Original ticket above. One relevant in-repo signal stands in for a comment: `services/MediaServices/index.ts`'s `searchByTitle` doc comment already anticipates this ticket by name ("biblioteca's search ships in a later ticket"), confirming this scope was deliberately deferred, not overlooked.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| PRD implies a single "search/filter for biblioteca" capability is straightforward | `MediaServices.searchByTitle` exists but is scoped to RIK-10's add-to-list control: capped at 10 results, no `user_media_status` join, no type/genre/year/rating/availability filters, no pagination story for "several thousand rows" scale | This ticket cannot reuse `searchByTitle` as-is; it needs new, wider methods (see Requested field mapping) |
| PRD lists "disponibilidad en servicio activo" as one filter among several | `RecommendationServices` (services/RecommendationServices.ts) already solved the exact same problem — PostgREST cannot express the `media_availability` ↔ `user_subscriptions` join, decomposed into RLS-scoped chunked queries (`getActiveSubscriptionPairs`, `getAvailableMediaIdsForPairs`) — but those methods are `private` to that class | This ticket must add an equivalent **public** method, on `MediaAvailabilityServices` (the domain-correct home per `ARCHITECTURE.md`'s Services table: "`MediaAvailabilityServices` — availability lookups joined with `user_subscriptions`"), rather than importing `RecommendationServices`' private internals or duplicating the whole class |
| `ARCHITECTURE.md`'s Services table doesn't list a "LibraryServices" | Confirmed — the documented service list is `MediaServices`, `MediaAvailabilityServices`, `MediaStatusServices`, `SubscriptionServices`, `ListServices`, `ImdbImportServices`, `CatalogSnapshotServices`, `RecommendationServices` | This ticket must extend the existing `MediaServices`/`MediaStatusServices`/`MediaAvailabilityServices` classes, not introduce a new `LibraryServices` class that would contradict the documented architecture |
| `ARCHITECTURE.md`'s Server Actions table already assigns this scope | Verbatim: `media` — "Title detail reads, search/filter for biblioteca" | Confirms `actions/media/` (not a new `actions/library/` folder) is the intended home for the new `getLibrary` action |
| PRD's "Tabla o grilla" leaves the choice open | PRD's own text immediately resolves it: "para una biblioteca grande, DataTable es más eficiente" | Use `components/Table/DataTable.tsx` (already built for RIK-5's import batch detail), not a `MediaCard` grid |
| PRD lists `components.json` as `"style": "lyra"` | Real `components.json` is `"style": "base-lyra"` (Base UI, not Radix) | Any new shadcn primitive (`tabs`) must be added via the CLI with the project's real config |

### Current database state

No migration is needed — every column this ticket reads already exists and is already used elsewhere in the codebase:

**`user_media_status`** (the tab/status source): `user_id`, `media_id`, `watched`, `watched_at`, `want_to_watch`, `want_added_at`, `dismissed`, `personal_rating`, `source`, `manually_edited`. Owner-only RLS (`owner_all`, `auth.uid() = user_id`).

**`media_items`**: `id`, `imdb_id`, `type` (`'movie' | 'tv'`), `title`, `year`, `poster_url`, `imdb_rating`, `imdb_votes`, `is_stub`, `slug`. Publicly readable (including `anon`).

**`genres` / `media_genres`**: publicly readable, used by `RecommendationServices.applyGenreFilter` today as the model for chunked genre filtering — same pattern applies here.

**`media_availability` / `user_subscriptions`**: same PostgREST-join limitation and RLS boundaries already solved once by `RecommendationServices` (see discrepancies table) — this ticket reuses that solved shape, promoted to a shared, public method.

**Code usage today**: `MediaStatusServices` (`services/MediaStatusServices/index.ts`) has per-title reads/writes (`getForUser`, `markWatched`, etc.) but no method that lists **all** status rows for a user — every existing consumer (title ficha, panel, recommendations) only ever needs one row or a small candidate set built from watchlist membership. This ticket is the first consumer that needs "all of a user's `user_media_status` rows, optionally filtered by watched/want_to_watch."

### Current logic (biblioteca)

No existing implementation — confirmed via `find app/\(app\)/biblioteca`, `find features/library`, `grep -r "getLibrary"` all returning nothing. `lib/supabase/proxy.ts`'s `PROTECTED_PREFIXES` already includes `/biblioteca` (added ahead of this ticket, presumably alongside the RIK-12 shell work), so the route is already guarded at the middleware layer once the page exists.

### Requested field mapping

Every field the PRD asks for already exists; nothing new is created.

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| Tab: Vistas / Quiero ver / Todas | filter | `user_media_status.watched` / `.want_to_watch` / (no filter — every row for the user) | already exists (reuse) |
| Filtro tipo | enum | `media_items.type` (`'movie' \| 'tv'`) | already exists (reuse) |
| Filtro género | FK | `genres` via `media_genres`, same chunked-lookup pattern as `RecommendationServices.applyGenreFilter` | already exists (reuse) |
| Filtro año | number | `media_items.year` | already exists (reuse) |
| Filtro rango de calificación | number | `media_items.imdb_rating` (`gte` threshold, mirroring `RECOMMENDATION_THRESHOLDS` usage) | already exists (reuse) |
| Filtro disponibilidad en servicio activo | boolean | `media_availability.is_available` cross-referenced with `user_subscriptions` (`ended_on is null`) — same decomposition as `RecommendationServices` | already exists (reuse, new public method) |
| Buscador por título | text | `media_items.title` (`ilike`, same as `searchByTitle`) | already exists (reuse) |
| Resultado (tabla) | rows | `media_items` + `user_media_status` composite, new view-specific DTO | new DTO, no new column |

### Impacted files

**App routes**
- `app/(app)/biblioteca/page.tsx` — new. Async Server Component; reads Next.js 16 `searchParams` (tab, query, type, genre, year range, rating min, availability flag), calls `actions/media/getLibrary`, renders `features/library/LibraryScreen`.

**Actions**
- `actions/media/getLibrary.ts` (extends the existing `actions/media/index.ts` barrel) — new. Session-scoped (own `user_media_status` rows only), orchestrates the services below into the table's row shape.

**Services**
- `services/MediaStatusServices/index.ts` — extended with `listForUser(userId, filter?: { watched?: boolean; wantToWatch?: boolean })`.
- `services/MediaServices/index.ts` — extended with a new method (e.g. `getManyWithFilters`) accepting a candidate `mediaIds` list plus `{ type?, genreSlug?, yearMin?, yearMax?, ratingMin?, query? }`.
- `services/MediaAvailabilityServices/index.ts` — extended with a new public `getAvailableMediaIds(mediaIds, activePairs)` (promoted from the pattern `RecommendationServices`' private methods already established) plus reuse of `SubscriptionServices.getActiveForUser` (already added in RIK-9) for the active pairs.
- `services/index.ts` — barrel export update if new types are introduced.

**Features**
- `features/library/LibraryScreen.tsx` — new. Server Component composing tabs, filter bar, search, and `DataTable`.
- `features/library/LibraryFilters.tsx` — new. Client Component: type `Select`, genre `Select` (mirrors `features/recommendations/GenreFilterSelect.tsx`), year inputs, rating preset `Select`, availability `Checkbox` — all writing to URL search params.
- `features/library/LibrarySearchInput.tsx` — new. Client Component: title search box writing the `q` search param.
- `features/library/LibraryTable.tsx` — new. `DataTable` column definitions for the result rows (title, year, type, IMDb rating, personal status badges, availability badge), row click navigates to `/titulo/[slug]`.
- `features/library/EmptyLibraryState.tsx` — new. Empty-state message + CTA to `/importar`.

**UI primitives (new via shadcn CLI, `base-lyra` style)**
- `components/ui/tabs.tsx` — does not exist yet (confirmed via `ls components/ui/`).

**No changes** to `types/index.ts` base types, `supabase/migrations/`, or `actions/media-status/` (biblioteca's row actions, if any are added later, are out of scope here — see Out of scope).

### Decisions made

1. **"Todas" means every `user_media_status` row for the user (their touched history), not the whole public catalog.** Rationale: PRD Section 2.2 frames the screen's purpose as "explorar y gestionar **todo el historial personal**" — a catalog browser would be a different screen with different RLS implications (reading titles the user never touched). Recommended default, unconfirmed — flagged in `<clarify_before_coding>`.
2. **Availability check reuses `RecommendationServices`' already-solved decomposition, promoted to a new public method on `MediaAvailabilityServices`, not a private copy inside a new service.** Rationale: `ARCHITECTURE.md` explicitly assigns availability-lookup responsibility to `MediaAvailabilityServices`; duplicating the whole chunked-pagination pattern into a third file would violate this repo's own established "extend pre-existing service/action files instead of duplicating them" convention (confirmed via `graphify-out/GRAPH_REPORT.md`'s hyperedge on this exact convention).
3. **Rating filter is a small set of preset thresholds (e.g. "Cualquiera", "7+", "8+", "9+") via `Select`, not a dual-range slider.** Rationale: no `Slider` primitive exists in `components/ui/` today, and PRD's "rango de calificación" is satisfied by a minimum-threshold filter (mirrors `RECOMMENDATION_THRESHOLDS`' existing `gte` pattern) without introducing a new primitive for one filter. Recommended default.
4. **Year filter is two plain number `Input`s (from/to), not a dedicated range component.** Rationale: same reasoning as rating — avoids a new primitive for a single filter; `media_items.year` is a plain integer column, a `gte`/`lte` pair is a direct, low-risk mapping. Recommended default.
5. **All filters, the tab, and the search query are modeled as URL search params** (mirroring `features/recommendations/GenreFilterSelect.tsx`'s existing pattern exactly: client components call `router.push` with an updated `URLSearchParams`, the Server Component page reads `searchParams`). Rationale: keeps `/biblioteca` results shareable/bookmarkable and avoids introducing a Zustand store for state `ARCHITECTURE.md` doesn't mandate a store for. Confirmed pattern already in the codebase, not a new idea.
6. **`DataTable` (not a `MediaCard` grid) for the result.** Rationale: PRD's own text explicitly recommends this for a large library; `components/Table/DataTable.tsx` already exists and handles client-side sorting/pagination over a full result array, matching this ticket's data shape.
7. **No manual watched/watchlist toggle actions are added to the table rows in this ticket.** Rationale: `actions/media-status/` (RIK-9's canonical write path) already exists and could be wired into row actions, but the PRD's Content/Componentes text for `/biblioteca` doesn't call out inline mutation controls the way the panel/ficha screens do — row click to the ficha is the primary interaction. Recommended default; flagged as a cheap follow-up, not a blocker.

### Out of scope

- Inline watched/watchlist toggle buttons on table rows — PRD doesn't call these out for this screen; the ficha (`/titulo/[slug]`) already owns that interaction. Follow-up candidate, not built here.
- A `MediaCard` grid alternative view or a view-mode toggle — PRD's own text resolves the table-vs-grid question in favor of `DataTable` for this screen.
- Full-text/fuzzy search — `ilike` substring match only, matching `searchByTitle`'s existing precedent.
- Pagination beyond `DataTable`'s existing client-side pagination — no server-side cursor pagination is introduced; the same 1000-row-page + chunked-filter strategy `RecommendationServices` already uses caps a single query's practical size, consistent with that ticket's own documented scale assumption.
- Font family / typography — explicitly excluded from this whole gap-analysis pass by the requester.

---

## Implementation plan

**Goal:** Ship `/biblioteca` as the third PRD gap in this series — a filterable, searchable, tabbed view over the user's entire `user_media_status` history — by extending three already-existing services rather than introducing a new one, and reusing the URL-search-param filter pattern `GenreFilterSelect` already established.

**In scope:**
1. Services: `MediaStatusServices.listForUser`, `MediaServices.getManyWithFilters`, `MediaAvailabilityServices.getAvailableMediaIds` (new public method).
2. Action: `actions/media/getLibrary.ts` — session-scoped orchestration of the three services above by tab/filters.
3. shadcn addition: `tabs` (Base UI / `base-lyra`).
4. Route: `app/(app)/biblioteca/page.tsx` reading `searchParams`.
5. Features: `LibraryScreen`, `LibraryFilters`, `LibrarySearchInput`, `LibraryTable`, `EmptyLibraryState`.

**Out of scope:** inline row mutation actions, grid view mode, full-text search, server-side cursor pagination — see Out of scope above.

**Key risks / compatibility:**
- `user_media_status` can legitimately hold several thousand rows per user (IMDb ratings + watchlist imports) — the same "PostgREST caps at ~1000 rows, `.in()` blows up past a few hundred UUIDs" constraint `RecommendationServices` already documents applies here; reuse its chunked-pagination approach rather than a naive single query.
- The availability filter's promoted `MediaAvailabilityServices.getAvailableMediaIds` method must not become a second source of truth that drifts from `RecommendationServices`' existing logic — keep the matching semantics (`is_available = true`, `platform_id + country` pair match) identical.
- `DataTable` renders its full `data` array client-side — the action must apply all filters server-side before returning rows, not rely on the table to filter further.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `LibraryScreen`'s `Tabs`, `MediaStatusServices.listForUser` filter param |
| AC-2 | `LibraryFilters` type/genre/year/rating controls + `MediaServices.getManyWithFilters` |
| AC-3 | `LibraryFilters`' availability `Checkbox` + `MediaAvailabilityServices.getAvailableMediaIds` |
| AC-4 | `LibrarySearchInput` + `ilike` query in `getManyWithFilters` |
| AC-5 | `LibraryTable` (`DataTable`) rendering and row-click navigation |
| AC-6 | `EmptyLibraryState` |
| AC-7 | URL search params round-trip (shareable/bookmarkable results) |

---

## Claude Code prompt

```xml
<task id="RIK-14" title="Mi biblioteca">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full. Its Services table lists exactly: MediaServices,
      MediaAvailabilityServices, MediaStatusServices, SubscriptionServices, ListServices,
      ImdbImportServices, CatalogSnapshotServices, RecommendationServices — no "LibraryServices". Its
      Server Actions table assigns "Title detail reads, search/filter for biblioteca" to the `media`
      folder. Its "Conventions worth preserving" section explicitly favors extending existing
      service/action files over duplicating them — this ticket must follow that.</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data.
      Read node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md for the async
      `searchParams` prop convention before writing app/(app)/biblioteca/page.tsx.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 2.2 ("/biblioteca — Mi biblioteca") — the
      full content spec: tabs, filter set, search, table-vs-grid guidance ("para una biblioteca grande,
      DataTable es más eficiente"), empty state.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md Section 5 (user_media_status — read fully; the
      independence of watched/want_to_watch, the dismissed flag, and the unique (user_id, media_id)
      constraint are all load-bearing for this ticket).</item>
    <item>services/RecommendationServices.ts — read in full. This is the template for EVERYTHING this
      ticket needs to build around the availability filter: the paginate() helper, the chunk() helper, the
      PostgREST join limitation it documents in getMonthlyWatchlist's doc comment, and its private
      getActiveSubscriptionPairs/getAvailableMediaIdsForPairs methods, whose LOGIC (not code, since they
      are private to that class) you are promoting to a new public method elsewhere.</item>
    <item>services/MediaServices/index.ts — read in full, especially searchByTitle's doc comment (which
      names this exact ticket) and getBySlugWithDetails (for the query-shape conventions this file already
      follows: row types, mapMediaItemRow, chunked .in() usage patterns).</item>
    <item>services/MediaStatusServices/index.ts — read in full; you are adding one new method
      (listForUser) alongside the existing per-title methods, following their exact row-mapping
      conventions.</item>
    <item>services/MediaAvailabilityServices/index.ts and services/SubscriptionServices/index.ts — read in
      full. getAvailableForMedia (single-title) already exists; you add a new bulk
      getAvailableMediaIds(mediaIds, activePairs) method here. getActiveForUser (SubscriptionServices,
      added in RIK-9) already gives you the active (platformId, country) pairs — reuse it, do not
      reimplement it.</item>
    <item>features/recommendations/GenreFilterSelect.tsx and actions/recommendations/getGenres.ts — the
      exact URL-search-param filter pattern to mirror for every new filter control in this ticket (client
      component reads useSearchParams/usePathname/useRouter, calls router.push with an updated
      URLSearchParams; the Server Component page reads the resulting searchParams).</item>
    <item>components/Table/DataTable.tsx and features/import/components/BatchDetailTable.tsx — the
      existing DataTable usage pattern (LegacyColumnDef arrays, TanStack React Table legacy API) to mirror
      for features/library/LibraryTable.tsx.</item>
    <item>components.json — confirm the real shadcn config ("style": "base-lyra", "baseColor": "mist")
      before adding the new `tabs` primitive.</item>
    <item>lib/supabase/proxy.ts — confirm /biblioteca is already in PROTECTED_PREFIXES (it is); no
      middleware change is needed for this ticket.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    /biblioteca is where a Rikuna user browses their ENTIRE personal watch history — every title they've
    marked watched or want-to-watch, whether via manual action (RIK-9) or IMDb CSV import (RIK-4) — not a
    browser of the whole public catalog. The screen has three tabs (Vistas: watched=true, Quiero ver:
    want_to_watch=true, Todas: every user_media_status row for the user regardless of flags), a filter bar
    (type, genre, year range, minimum rating, "available on my active subscription"), a title search box,
    and a DataTable of results. Every filter and the active tab live in the URL as search params, exactly
    like features/recommendations/GenreFilterSelect.tsx already does for the genre filter on
    /recomendaciones — this ticket generalizes that same pattern to more filters and a new screen.

    The data source for every row is user_media_status (owner-only RLS, auth.uid() = user_id) joined to
    media_items (publicly readable). Genre filtering joins through media_genres, same chunked lookup
    RecommendationServices.applyGenreFilter already implements. Availability filtering needs the same
    media_availability <-> user_subscriptions decomposition RecommendationServices already solved (PostgREST
    cannot express that join as a single embedded select since it's matched on platform_id+country, not a
    foreign key) — but RecommendationServices's relevant methods are PRIVATE to that class, so this ticket
    adds an equivalent PUBLIC method on MediaAvailabilityServices instead of reaching into
    RecommendationServices' internals or copy-pasting the whole class.

    services/MediaServices/index.ts's searchByTitle already carries a doc comment anticipating this exact
    ticket: "No established search method existed yet for RIK-3/RIK-9 to reuse (biblioteca's search ships
    in a later ticket)." That existing method stays as-is (RIK-10's add-to-list control still uses it,
    capped at 10 results) — this ticket adds a NEW, wider method rather than changing searchByTitle's
    existing behavior/signature.

    user_media_status can hold several thousand rows for a single user (a full IMDb ratings + watchlist
    import). RecommendationServices already documents and solves the resulting scale problem: PostgREST
    caps unpaginated selects around 1000 rows locally, and GET URLs break past a few hundred UUIDs in an
    .in() filter. Reuse its paginate()/chunk() pattern (or an equivalent local implementation) rather than
    writing a naive single query that silently truncates a large library.
  </context>

  <ground_truth_db_notes critical="true">
    <note>No new migration is needed — every column this ticket reads already exists in
      supabase/migrations/, already used by RIK-1/RIK-3/RIK-4/RIK-9. Re-confirm exact column names against
      the latest migration file before writing queries, but do not expect to add any.</note>
    <note>"Todas" (the third tab) means every user_media_status row belonging to the current user —
      NOT the entire media_items catalog. A title the user has never touched (no user_media_status row at
      all) does not appear in any tab of this screen.</note>
    <note>user_media_status is owner-only RLS for BOTH read and write (owner_all policy, auth.uid() =
      user_id). Every query this ticket adds must run through the request-scoped, cookie-bound Supabase
      client (lib/supabase/server.ts's createClient()) so auth.uid() resolves — never lib/supabase/admin.ts,
      which is ingestion-only.</note>
    <note>media_items, genres, media_genres, media_availability, platforms are publicly readable
      (including anon) per RLS — only the user_media_status join and the user_subscriptions lookup require
      the authenticated session.</note>
    <note>RecommendationServices' getActiveSubscriptionPairs and getAvailableMediaIdsForPairs are PRIVATE
      methods on that class — you cannot import or call them directly. Re-implement the same LOGIC (active
      pairs via user_subscriptions where ended_on is null; availability via media_availability where
      is_available=true, OR-matched across the active pairs' platform_id+country) as a new PUBLIC method,
      e.g. getAvailableMediaIds(mediaIds, activePairs), on MediaAvailabilityServices — that class is
      already the documented home for "availability lookups joined with user_subscriptions" per
      ARCHITECTURE.md.</note>
    <note>SubscriptionServices.getActiveForUser(userId) already exists (added in RIK-9) and returns the
      user's active user_subscriptions rows — reuse it to build the (platformId, country) pairs for the
      availability filter; do not add a second "get active subscriptions" method.</note>
    <note>components.json's real "style" value is "base-lyra" (Base UI), NOT "lyra" as the PRD's Section
      1.3 documents. Add the new `tabs` primitive via the shadcn CLI using the real config; do not
      hand-write Radix-specific APIs.</note>
    <note>components/ui/tabs.tsx does NOT exist yet (confirmed via `ls components/ui/`) — it must be added.
      select.tsx, checkbox.tsx, input.tsx, and components/Table/DataTable.tsx already exist and are
      reused as-is.</note>
    <note>lib/supabase/proxy.ts's PROTECTED_PREFIXES already includes "/biblioteca" — no middleware change
      is needed; the route is already guarded once app/(app)/biblioteca/page.tsx exists.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="UI primitives">
      <item>Add `tabs` via the shadcn CLI using the project's real components.json config (style:
        base-lyra, baseColor: mist).</item>
    </phase>

    <phase title="Services — status">
      <item>In services/MediaStatusServices/index.ts, add `async listForUser(userId: string, filter?: {
        watched?: boolean; wantToWatch?: boolean }): Promise&lt;UserMediaStatus[]&gt;` — queries
        user_media_status where user_id = userId, applying .eq('watched', filter.watched) and/or
        .eq('want_to_watch', filter.wantToWatch) only when those keys are present in filter (omitting both
        returns every row for the user, for the "Todas" tab). Use the same paginate()-style chunked reads
        RecommendationServices demonstrates so a multi-thousand-row personal history isn't silently
        truncated.</item>
    </phase>

    <phase title="Services — media filtering">
      <item>In services/MediaServices/index.ts, add a new method (e.g. `getManyWithFilters(mediaIds:
        string[], filters: { type?: MediaType; genreSlug?: string; yearMin?: number; yearMax?: number;
        ratingMin?: number; query?: string }): Promise&lt;MediaItem[]&gt;`) that: chunks mediaIds per
        RecommendationServices' ID_CHUNK_SIZE convention; applies .eq('type', filters.type) when set;
        applies .gte('year', yearMin) / .lte('year', yearMax) when set; applies .gte('imdb_rating',
        ratingMin) when set; applies .ilike('title', `%${query}%`) when query is set; for genreSlug,
        pre-narrow mediaIds using the same media_genres chunked-lookup approach
        RecommendationServices.applyGenreFilter already implements (resolve the genre's id from slug first,
        then intersect). Do not modify searchByTitle's existing signature or behavior.</item>
    </phase>

    <phase title="Services — availability">
      <item>In services/MediaAvailabilityServices/index.ts, add a new public method
        `getAvailableMediaIds(mediaIds: string[], activePairs: { platformId: string; country: string }[]):
        Promise&lt;string[]&gt;` implementing the same logic as RecommendationServices' private
        getAvailableMediaIdsForPairs/getAvailableMediaIds (chunked .in() lookups against media_availability
        where is_available=true, OR-matched across the active pairs' platform_id+country using the same
        `and(platform_id.eq.X,country.eq.Y)` OR-filter construction). Keep the matching semantics
        byte-identical to RecommendationServices' existing logic so the two services never disagree about
        what "available" means.</item>
    </phase>

    <phase title="Action">
      <item>Create actions/media/getLibrary.ts (extend actions/media/index.ts's barrel) exporting an async
        function getLibrary(params: { tab: 'watched' | 'want_to_watch' | 'all'; query?: string; type?:
        MediaType; genreSlug?: string; yearMin?: number; yearMax?: number; ratingMin?: number; onlyAvailable?:
        boolean }) that: reads the session via the request-scoped client, throws/returns an explicit
        unauthorized result if absent; calls MediaStatusServices.listForUser with the tab mapped to {
        watched: true } / { wantToWatch: true } / undefined; extracts the resulting media_id list; calls
        MediaServices.getManyWithFilters with that id list and the remaining filters; when onlyAvailable is
        true, additionally calls SubscriptionServices.getActiveForUser +
        MediaAvailabilityServices.getAvailableMediaIds and intersects the result; returns the final
        MediaItem[] plus, for each item, its corresponding user_media_status flags (compose a small
        LibraryRow DTO locally in this file — do not add it to types/index.ts, it's a view-specific
        composite).</item>
    </phase>

    <phase title="Route">
      <item>Create app/(app)/biblioteca/page.tsx as an async Server Component. Await the Next.js 16
        searchParams prop (tab, q, tipo, genero, anioDesde, anioHasta, calificacion, disponible). Call
        getGenres() (existing action) for the genre filter's options. Call getLibrary() with the parsed
        params. Render features/library/LibraryScreen with the results, the current filter state, and the
        genre list.</item>
    </phase>

    <phase title="Features">
      <item>Create features/library/LibraryScreen.tsx (Server Component): renders the Tabs (Vistas/Quiero
        ver/Todas, tab switch navigates via a link that sets the `tab` search param, preserving other
        active filters), LibraryFilters, LibrarySearchInput, and either LibraryTable (when results is
        non-empty or filters are active) or EmptyLibraryState (when the user's entire history is empty
        AND no filters are active).</item>
      <item>Create features/library/LibraryFilters.tsx (Client Component): type Select ("Todos" / "Película"
        / "Serie"), genre Select (mirrors GenreFilterSelect.tsx exactly, reusing its ALL_GENRES sentinel
        pattern), two year number Inputs (desde/hasta), a rating preset Select ("Cualquiera" / "7+" / "8+" /
        "9+"), and a "Solo disponible en mi suscripción activa" Checkbox — every control updates the URL via
        router.push(new URLSearchParams(...)), same as GenreFilterSelect.</item>
      <item>Create features/library/LibrarySearchInput.tsx (Client Component): a text Input that updates
        the `q` search param on Enter/blur (debounce not required — a submit-on-commit UX is sufficient and
        avoids extra dependencies).</item>
      <item>Create features/library/LibraryTable.tsx (Client Component wrapping DataTable): column
        definitions for title (Link to /titulo/[slug]), year, type (localized label), IMDb rating, a status
        Badge (Visto / Quiero ver, from the row's user_media_status flags), and an availability Badge when
        the row is in the active-subscription-available set. Mirror
        features/import/components/BatchDetailTable.tsx's LegacyColumnDef usage pattern.</item>
      <item>Create features/library/EmptyLibraryState.tsx: message inviting the user to import their IMDb
        history, with a Button linking to /importar.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Switching between the three tabs (Vistas, Quiero ver, Todas) changes the result
      set to exactly the titles matching that tab's user_media_status flag(s) for the current user, and the
      active tab is reflected in the URL. Verify: seed a user with at least one watched-only title, one
      want-to-watch-only title, and one with neither; confirm each tab shows exactly the expected
      subset.</criterion>
    <criterion id="AC-2">Setting the type, genre, year range, and minimum rating filters (individually and
      combined) narrows the visible rows to exactly the matching set, and each filter's state is reflected
      in the URL as a search param. Verify: apply each filter alone against seeded data with known
      type/genre/year/rating values and confirm the exact expected rows remain; combine two filters and
      confirm the intersection is correct.</criterion>
    <criterion id="AC-3">Enabling "solo disponible en mi suscripción activa" narrows results to titles with
      an is_available=true media_availability row matching one of the user's active user_subscriptions
      (platform_id + country, ended_on is null); disabling it restores the unfiltered set. Verify: seed one
      title available on the user's active subscription and one that is not (or has no availability row);
      confirm only the former remains with the filter on.</criterion>
    <criterion id="AC-4">Typing a search query and submitting narrows results to titles whose title
      contains the query (case-insensitive), combinable with the other active filters. Verify: search a
      known substring of one seeded title's name, confirm only matching titles remain, alongside an active
      tab/filter.</criterion>
    <criterion id="AC-5">Results render in a DataTable with working client-side sort and pagination
      (inherited from the existing DataTable component), and clicking a row navigates to that title's
      /titulo/[slug]. Verify: sort by a sortable column, confirm order changes; click a row, confirm
      navigation to the correct ficha.</criterion>
    <criterion id="AC-6">A user with zero user_media_status rows and no active filters sees the empty-state
      message with a working link to /importar, instead of an empty table. Verify: use a fresh test account
      with no import history, navigate to /biblioteca, confirm the empty state (not a blank table) and that
      the CTA navigates to /importar.</criterion>
    <criterion id="AC-7">The full filter state (tab, query, type, genre, year range, rating, availability)
      round-trips through the URL — reloading the page with a given query string reproduces the same
      filtered result set. Verify: apply a combination of filters, copy the resulting URL, open it fresh
      (or reload), confirm identical results and identical control states.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new supabase/migrations/ file — every field this ticket reads already
      exists.</item>
    <item>Do NOT introduce a new "LibraryServices" class — extend MediaStatusServices, MediaServices, and
      MediaAvailabilityServices per ARCHITECTURE.md's documented Services table.</item>
    <item>Do NOT modify searchByTitle's existing signature or behavior — RIK-10's add-to-list control
      still depends on it exactly as it is.</item>
    <item>Do NOT reach into RecommendationServices' private methods — reimplement the equivalent logic as
      a new public method on MediaAvailabilityServices instead.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere touched by this ticket — it is ingestion-only.</item>
    <item>Do NOT add inline watched/watchlist toggle mutations to the table rows — out of scope for this
      ticket (see Out of scope).</item>
    <item>Do NOT hand-write Radix-based component internals — add `tabs` via the shadcn CLI using the
      real "base-lyra" config.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
    <item>Do not touch font-family/typography configuration — explicitly out of scope for this ticket per
      the requester.</item>
  </constraints>

  <out_of_scope>
    <item>Inline watched/watchlist toggle buttons on table rows — follow-up candidate, not built here (see
      Decision 7).</item>
    <item>A MediaCard grid view or a view-mode toggle — PRD resolves table-vs-grid in favor of
      DataTable.</item>
    <item>Full-text/fuzzy search — ilike substring only.</item>
    <item>Server-side cursor pagination beyond DataTable's existing client-side pagination.</item>
    <item>Font family / typography — explicitly excluded from this whole gap-analysis pass by the
      requester.</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/MediaStatusServices/index.ts — `async listForUser(userId: string, filter?: { watched?:
      boolean; wantToWatch?: boolean }): Promise&lt;UserMediaStatus[]&gt;`.</item>
    <item>services/MediaServices/index.ts — `async getManyWithFilters(mediaIds: string[], filters: {
      type?: MediaType; genreSlug?: string; yearMin?: number; yearMax?: number; ratingMin?: number; query?:
      string }): Promise&lt;MediaItem[]&gt;`.</item>
    <item>services/MediaAvailabilityServices/index.ts — `async getAvailableMediaIds(mediaIds: string[],
      activePairs: { platformId: string; country: string }[]): Promise&lt;string[]&gt;`.</item>
    <item>actions/media/getLibrary.ts — define `type LibraryTab = 'watched' | 'want_to_watch' | 'all'` and
      a local `type LibraryRow = { media: MediaItem; status: Pick&lt;UserMediaStatus, 'watched' |
      'wantToWatch'&gt;; isAvailable: boolean }` composite, not added to types/index.ts.</item>
    <item>features/library/LibraryFilters.tsx — reuse GenreFilterSelect.tsx's ALL_GENRES-style sentinel
      pattern for the type Select too, since Base UI's Select also cannot hold an empty-string item
      value.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created and wired together end-to-end (route ->
      feature -> action -> service -> Supabase).</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one, but note in the work log where MediaServices /
      MediaStatusServices / MediaAvailabilityServices tests should live once a framework is
      introduced.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether "Todas" should include dismissed-only rows (want_to_watch=false, watched=false,
      dismissed=true) or exclude them as effectively "not part of the library". Default if unconfirmed:
      include them — "todo el historial personal" per the PRD is read literally as every row, and excluding
      dismissed titles would hide state the user might want to review/undo.</item>
    <item>Exact rating filter presets. Default if unconfirmed: "Cualquiera" (no filter), "7+", "8+",
      "9+".</item>
    <item>Whether year filter should be two separate inputs (desde/hasta) or a single exact-year field.
      Default if unconfirmed: two inputs (desde/hasta), more useful for a personal library spanning many
      years.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-7): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-14: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-14_mi_biblioteca.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to mi_biblioteca, matching specs/backlog/RIK-14_mi_biblioteca.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-14_mi_biblioteca.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: services / actions / features / components / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference the ticket id in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (for example a new feature uses the sparkles emoji, a bugfix the bug emoji, a schema or config change the wrench emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket (Linear, GitHub Issues, etc.). The audience is the ticket author and the product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section since this ticket is fully user-visible UI; a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Translate them into product language (say "the library page" instead of naming the route, "the watched filter" instead of naming columns).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots: list 2-3 numbered items — e.g. "Library — Vistas tab with filters applied", "Library — empty state for a fresh account". Prefix each with `[attach: short label]`.</item>
      <item>Do NOT embed images — attachments are added by the human.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is Mixed UI + Database: include "##
        Prerequisites" (dev server running, a logged-in test user with a mix of watched, want-to-watch, and
        untouched titles, at least one with a known genre/year/rating and one matching an active
        subscription's availability), then "## UI validation" (numbered steps: switch tabs, apply each
        filter individually and combined, search by title substring, sort/paginate the table, click a row
        to confirm ficha navigation, reload a filtered URL to confirm it reproduces the same
        results), then "## Database validation" (read-only SQL against user_media_status/media_items
        matching the acceptance criteria's expected sets, using real table/column names), then "##
        Expected outcome" (bullets tying back to AC-1 through AC-7).</item>
      <item>Use concrete app paths: /biblioteca, /titulo/[slug], /importar.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```

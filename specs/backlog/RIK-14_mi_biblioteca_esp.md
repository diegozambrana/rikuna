# RIK-14 — Mi biblioteca

> Documento de lectura. La fuente de verdad es [`RIK-14_mi_biblioteca.md`](./RIK-14_mi_biblioteca.md).

## Resumen del ticket

Construir `/biblioteca`, la pantalla para explorar y gestionar todo el historial personal de un usuario — cada título que marcó como visto, quiero ver, o que tocó de alguna otra forma, ya sea importado desde IMDb o marcado manualmente. Tres tabs (Vistas / Quiero ver / Todas), filtros (tipo, género, año, calificación, disponibilidad en la suscripción activa), un buscador de título, y un resultado denso en `DataTable` — todo filtrado del lado del servidor vía parámetros de búsqueda de la URL para que los resultados sigan siendo compartibles/guardables como marcador, y paginados del lado del cliente.

- Sin esquema nuevo: todo se lee de `user_media_status` (ya la única fuente de "visto"/"quiero ver"/"descartado") unido a `media_items`, `genres`, y (para el filtro de disponibilidad) `media_availability` + `user_subscriptions` — todas tablas que RIK-1/RIK-3/RIK-4/RIK-9 ya llenan.
- `services/MediaServices/index.ts` ya tiene un comentario de código que marca exactamente este vacío: *"No established search method existed yet for RIK-3/RIK-9 to reuse (biblioteca's search ships in a later ticket)."* Este ticket es ese ticket posterior.
- Estado vacío: cero filas de `user_media_status` para el usuario → invitación a `/importar`, según el PRD.
- No hay comentarios de equipo — derivado del mismo análisis de vacíos que RIK-12/RIK-13. La familia tipográfica queda explícitamente fuera de alcance por pedido del solicitante.

---

## Contexto

### Ticket original

No existe un ticket de tracker para este trabajo; se definió comparando directamente `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` Sección 2.2 ("`/biblioteca` — Mi biblioteca") contra el repositorio real — confirmado vía `find`/`grep` que no existe ningún `app/(app)/biblioteca/`, `features/library/`, ni método de servicio con alcance de biblioteca en ningún lado.

Requisitos del PRD incorporados aquí (Sección 2.2, intención verbatim):

- **Propósito:** explorar y gestionar todo el historial personal.
- **Contenido:** `Tabs` — "Vistas" / "Quiero ver" / "Todas". Una barra de filtros (tipo, género, año, rango de calificación, disponibilidad en el servicio activo) y un buscador por título. Tabla o grilla con los resultados.
- **Componentes sugeridos:** `Tabs`, `Input` de búsqueda, filtros `Select`/`Popover`, `DataTable` o una grilla de `Card` — el PRD favorece explícitamente `DataTable` para una biblioteca grande ("para una biblioteca grande, DataTable es más eficiente").
- **Estados:** biblioteca vacía → mensaje invitando a importar desde IMDb.

### Comentarios del equipo

Ninguno — ver "Ticket original" arriba. Una señal relevante dentro del repo hace las veces de comentario: el comentario de documentación de `searchByTitle` en `services/MediaServices/index.ts` ya anticipa este ticket por nombre ("biblioteca's search ships in a later ticket"), confirmando que este alcance fue diferido deliberadamente, no pasado por alto.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el código | Impacto |
| --- | --- | --- |
| El PRD da a entender que una sola capacidad de "búsqueda/filtro para biblioteca" es directa | `MediaServices.searchByTitle` existe pero está limitada al control de agregar-a-lista de RIK-10: tope de 10 resultados, sin join con `user_media_status`, sin filtros de tipo/género/año/calificación/disponibilidad, sin historia de paginación para escala de "varios miles de filas" | Este ticket no puede reutilizar `searchByTitle` tal cual; necesita métodos nuevos y más amplios (ver Mapeo de campos solicitados) |
| El PRD lista "disponibilidad en servicio activo" como un filtro entre varios | `RecommendationServices` (services/RecommendationServices.ts) ya resolvió exactamente el mismo problema — PostgREST no puede expresar el join `media_availability` ↔ `user_subscriptions`, descompuesto en queries encadenadas con RLS (`getActiveSubscriptionPairs`, `getAvailableMediaIdsForPairs`) — pero esos métodos son `private` a esa clase | Este ticket debe agregar un método **público** equivalente, en `MediaAvailabilityServices` (el hogar correcto por dominio según la tabla de Servicios de `ARCHITECTURE.md`: "`MediaAvailabilityServices` — availability lookups joined with `user_subscriptions`"), en vez de importar los internos privados de `RecommendationServices` o duplicar toda la clase |
| La tabla de Servicios de `ARCHITECTURE.md` no lista un "LibraryServices" | Confirmado — la lista de servicios documentada es `MediaServices`, `MediaAvailabilityServices`, `MediaStatusServices`, `SubscriptionServices`, `ListServices`, `ImdbImportServices`, `CatalogSnapshotServices`, `RecommendationServices` | Este ticket debe extender las clases `MediaServices`/`MediaStatusServices`/`MediaAvailabilityServices` existentes, no introducir una clase `LibraryServices` nueva que contradiga la arquitectura documentada |
| La tabla de Server Actions de `ARCHITECTURE.md` ya asigna este alcance | Verbatim: `media` — "Title detail reads, search/filter for biblioteca" | Confirma que `actions/media/` (no una carpeta nueva `actions/library/`) es el hogar previsto para la nueva acción `getLibrary` |
| El "Tabla o grilla" del PRD deja la elección abierta | El propio texto del PRD la resuelve de inmediato: "para una biblioteca grande, DataTable es más eficiente" | Usar `components/Table/DataTable.tsx` (ya construido para el detalle de importación de RIK-5), no una grilla de `MediaCard` |
| El PRD lista `components.json` como `"style": "lyra"` | El `components.json` real es `"style": "base-lyra"` (Base UI, no Radix) | Cualquier primitiva shadcn nueva (`tabs`) debe agregarse vía CLI con la config real del proyecto |

### Estado actual en la base de datos

No se necesita migración — cada columna que este ticket lee ya existe y ya se usa en otras partes del código:

**`user_media_status`** (la fuente de tab/estado): `user_id`, `media_id`, `watched`, `watched_at`, `want_to_watch`, `want_added_at`, `dismissed`, `personal_rating`, `source`, `manually_edited`. RLS solo-dueño (`owner_all`, `auth.uid() = user_id`).

**`media_items`**: `id`, `imdb_id`, `type` (`'movie' | 'tv'`), `title`, `year`, `poster_url`, `imdb_rating`, `imdb_votes`, `is_stub`, `slug`. Legible públicamente (incluyendo `anon`).

**`genres` / `media_genres`**: legibles públicamente, usados hoy por `RecommendationServices.applyGenreFilter` como el modelo para el filtrado de género en trozos (chunked) — el mismo patrón aplica aquí.

**`media_availability` / `user_subscriptions`**: misma limitación de join de PostgREST y los mismos límites de RLS ya resueltos una vez por `RecommendationServices` (ver tabla de discrepancias) — este ticket reutiliza esa forma ya resuelta, promovida a un método público compartido.

**Uso actual en código**: `MediaStatusServices` (`services/MediaStatusServices/index.ts`) tiene lecturas/escrituras por título (`getForUser`, `markWatched`, etc.) pero ningún método que liste **todas** las filas de estado de un usuario — cada consumidor existente (ficha de título, panel, recomendaciones) solo necesita una fila o un pequeño conjunto candidato construido a partir de la pertenencia a la watchlist. Este ticket es el primer consumidor que necesita "todas las filas de user_media_status de un usuario, opcionalmente filtradas por watched/want_to_watch."

### Lógica actual (biblioteca)

No hay implementación existente — confirmado vía `find app/\(app\)/biblioteca`, `find features/library`, `grep -r "getLibrary"`, todos sin resultados. El `PROTECTED_PREFIXES` de `lib/supabase/proxy.ts` ya incluye `/biblioteca` (agregado antes de este ticket, presumiblemente junto con el trabajo de shell de RIK-12), así que la ruta ya está protegida a nivel middleware una vez que la página exista.

### Mapeo de campos solicitados

Cada campo que pide el PRD ya existe; no se crea nada nuevo.

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Tab: Vistas / Quiero ver / Todas | filtro | `user_media_status.watched` / `.want_to_watch` / (sin filtro — todas las filas del usuario) | ya existe (reutilizar) |
| Filtro tipo | enum | `media_items.type` (`'movie' \| 'tv'`) | ya existe (reutilizar) |
| Filtro género | FK | `genres` vía `media_genres`, mismo patrón de búsqueda en trozos que `RecommendationServices.applyGenreFilter` | ya existe (reutilizar) |
| Filtro año | número | `media_items.year` | ya existe (reutilizar) |
| Filtro rango de calificación | número | `media_items.imdb_rating` (umbral `gte`, reflejando el uso de `RECOMMENDATION_THRESHOLDS`) | ya existe (reutilizar) |
| Filtro disponibilidad en servicio activo | booleano | `media_availability.is_available` cruzado con `user_subscriptions` (`ended_on is null`) — misma descomposición que `RecommendationServices` | ya existe (reutilizar, método público nuevo) |
| Buscador por título | texto | `media_items.title` (`ilike`, igual que `searchByTitle`) | ya existe (reutilizar) |
| Resultado (tabla) | filas | Compuesto de `media_items` + `user_media_status`, DTO nuevo específico de vista | DTO nuevo, ninguna columna nueva |

### Archivos impactados

**Rutas de app**
- `app/(app)/biblioteca/page.tsx` — nuevo. Server Component asíncrono; lee `searchParams` de Next.js 16 (tab, búsqueda, tipo, género, rango de año, calificación mínima, flag de disponibilidad), llama a `actions/media/getLibrary`, renderiza `features/library/LibraryScreen`.

**Actions**
- `actions/media/getLibrary.ts` (extiende el barrel existente `actions/media/index.ts`) — nuevo. Con alcance de sesión (solo las propias filas de `user_media_status`), orquesta los servicios de abajo en la forma de fila de la tabla.

**Servicios**
- `services/MediaStatusServices/index.ts` — extendido con `listForUser(userId, filter?: { watched?: boolean; wantToWatch?: boolean })`.
- `services/MediaServices/index.ts` — extendido con un método nuevo (p. ej. `getManyWithFilters`) que acepta una lista candidata `mediaIds` más `{ type?, genreSlug?, yearMin?, yearMax?, ratingMin?, query? }`.
- `services/MediaAvailabilityServices/index.ts` — extendido con un nuevo `getAvailableMediaIds(mediaIds, activePairs)` público (promovido del patrón ya establecido en los métodos privados de `RecommendationServices`) más la reutilización de `SubscriptionServices.getActiveForUser` (ya agregado en RIK-9) para los pares activos.
- `services/index.ts` — actualización del barrel si se introducen tipos nuevos.

**Features**
- `features/library/LibraryScreen.tsx` — nuevo. Server Component que compone tabs, barra de filtros, búsqueda y `DataTable`.
- `features/library/LibraryFilters.tsx` — nuevo. Client Component: `Select` de tipo, `Select` de género (refleja `features/recommendations/GenreFilterSelect.tsx`), inputs de año, `Select` de calificación preestablecida, `Checkbox` de disponibilidad — todos escribiendo a los parámetros de búsqueda de la URL.
- `features/library/LibrarySearchInput.tsx` — nuevo. Client Component: caja de búsqueda de título que escribe el parámetro `q`.
- `features/library/LibraryTable.tsx` — nuevo. Definiciones de columnas de `DataTable` para las filas de resultado (título, año, tipo, calificación IMDb, badges de estado personal, badge de disponibilidad), el clic en la fila navega a `/titulo/[slug]`.
- `features/library/EmptyLibraryState.tsx` — nuevo. Mensaje de estado vacío + CTA a `/importar`.

**Primitivas de UI (nuevas vía CLI de shadcn, estilo `base-lyra`)**
- `components/ui/tabs.tsx` — no existe todavía (confirmado vía `ls components/ui/`).

**Sin cambios** en los tipos base de `types/index.ts`, `supabase/migrations/`, ni `actions/media-status/` (las acciones de fila de biblioteca, si se agregan más adelante, están fuera de alcance aquí — ver Fuera de alcance).

### Decisiones tomadas

1. **"Todas" significa cada fila de `user_media_status` del usuario (su historial tocado), no todo el catálogo público.** Razón: el PRD Sección 2.2 enmarca el propósito de la pantalla como "explorar y gestionar **todo el historial personal**" — un navegador de catálogo sería una pantalla distinta con implicaciones de RLS distintas (leer títulos que el usuario nunca tocó). Default recomendado, no confirmado — marcado en `<clarify_before_coding>`.
2. **El chequeo de disponibilidad reutiliza la descomposición ya resuelta de `RecommendationServices`, promovida a un método público nuevo en `MediaAvailabilityServices`, no una copia privada dentro de un servicio nuevo.** Razón: `ARCHITECTURE.md` asigna explícitamente la responsabilidad de búsqueda de disponibilidad a `MediaAvailabilityServices`; duplicar todo el patrón de paginación en trozos en un tercer archivo violaría la convención propia de este repo de "extender archivos de servicio/acción preexistentes en vez de duplicarlos" (confirmado vía el hyperedge de `graphify-out/GRAPH_REPORT.md` sobre esta convención exacta).
3. **El filtro de calificación es un pequeño conjunto de umbrales preestablecidos (p. ej. "Cualquiera", "7+", "8+", "9+") vía `Select`, no un slider de rango doble.** Razón: no existe ninguna primitiva `Slider` en `components/ui/` hoy, y el "rango de calificación" del PRD se satisface con un filtro de umbral mínimo (refleja el patrón `gte` ya existente de `RECOMMENDATION_THRESHOLDS`) sin introducir una primitiva nueva para un solo filtro. Default recomendado.
4. **El filtro de año son dos `Input` numéricos simples (desde/hasta), no un componente de rango dedicado.** Razón: mismo razonamiento que la calificación — evita una primitiva nueva para un solo filtro; `media_items.year` es una columna entera simple, un par `gte`/`lte` es un mapeo directo y de bajo riesgo. Default recomendado.
5. **Todos los filtros, el tab y la consulta de búsqueda se modelan como parámetros de búsqueda de la URL** (reflejando exactamente el patrón ya existente de `features/recommendations/GenreFilterSelect.tsx`: los client components llaman `router.push` con un `URLSearchParams` actualizado, el Server Component de la página lee `searchParams`). Razón: mantiene los resultados de `/biblioteca` compartibles/guardables como marcador y evita introducir un store de Zustand para un estado que `ARCHITECTURE.md` no exige un store. Patrón ya confirmado en el código, no es una idea nueva.
6. **`DataTable` (no una grilla de `MediaCard`) para el resultado.** Razón: el propio texto del PRD recomienda explícitamente esto para una biblioteca grande; `components/Table/DataTable.tsx` ya existe y maneja orden/paginación del lado del cliente sobre un array de resultado completo, coincidiendo con la forma de datos de este ticket.
7. **No se agregan acciones manuales de alternar visto/watchlist a las filas de la tabla en este ticket.** Razón: `actions/media-status/` (la ruta de escritura canónica de RIK-9) ya existe y podría conectarse a acciones de fila, pero el texto de Contenido/Componentes del PRD para `/biblioteca` no menciona controles de mutación en línea de la forma en que lo hacen las pantallas de panel/ficha — el clic en la fila hacia la ficha es la interacción principal. Default recomendado; marcado como follow-up barato, no un bloqueante.

### Fuera de alcance

- Botones de alternar visto/watchlist en línea en las filas de la tabla — el PRD no los menciona para esta pantalla; la ficha (`/titulo/[slug]`) ya posee esa interacción. Candidato a follow-up, no construido aquí.
- Una vista alternativa de grilla `MediaCard` o un selector de modo de vista — el propio texto del PRD resuelve la pregunta tabla-vs-grilla a favor de `DataTable` para esta pantalla.
- Búsqueda de texto completo/difusa — solo coincidencia de subcadena `ilike`, igual que el precedente de `searchByTitle`.
- Paginación más allá de la paginación del lado del cliente ya existente de `DataTable` — no se introduce paginación por cursor del lado del servidor; la misma estrategia de página de 1000 filas + filtrado en trozos que `RecommendationServices` ya usa acota el tamaño práctico de una sola consulta, consistente con el supuesto de escala ya documentado de ese ticket.
- Familia tipográfica — explícitamente excluida de todo este análisis de vacíos por el solicitante.

---

## Plan de implementación

**Objetivo:** Entregar `/biblioteca` como el tercer vacío del PRD en esta serie — una vista filtrable, buscable y con tabs sobre todo el historial `user_media_status` del usuario — extendiendo tres servicios ya existentes en vez de introducir uno nuevo, y reutilizando el patrón de filtro por parámetro de URL que `GenreFilterSelect` ya estableció.

**En alcance:**
1. Servicios: `MediaStatusServices.listForUser`, `MediaServices.getManyWithFilters`, `MediaAvailabilityServices.getAvailableMediaIds` (método público nuevo).
2. Action: `actions/media/getLibrary.ts` — orquestación con alcance de sesión de los tres servicios de arriba por tab/filtros.
3. Adición de shadcn: `tabs` (Base UI / `base-lyra`).
4. Ruta: `app/(app)/biblioteca/page.tsx` leyendo `searchParams`.
5. Features: `LibraryScreen`, `LibraryFilters`, `LibrarySearchInput`, `LibraryTable`, `EmptyLibraryState`.

**Fuera de alcance:** acciones de mutación en línea en las filas, modo de vista de grilla, búsqueda de texto completo, paginación por cursor del lado del servidor — ver Fuera de alcance arriba.

**Riesgos clave / compatibilidad:**
- `user_media_status` puede legítimamente tener varios miles de filas por usuario (importaciones de calificaciones + watchlist de IMDb) — la misma restricción "PostgREST tope de ~1000 filas, `.in()` explota más allá de unos cientos de UUIDs" que `RecommendationServices` ya documenta aplica aquí; reutilizar su enfoque de paginación en trozos en vez de una consulta única ingenua.
- El método promovido `MediaAvailabilityServices.getAvailableMediaIds` del filtro de disponibilidad no debe convertirse en una segunda fuente de verdad que se desvíe de la lógica ya existente de `RecommendationServices` — mantener la semántica de coincidencia (`is_available = true`, coincidencia de par `platform_id + country`) idéntica.
- `DataTable` renderiza su array `data` completo del lado del cliente — la acción debe aplicar todos los filtros del lado del servidor antes de devolver filas, no depender de que la tabla filtre más.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | `Tabs` de `LibraryScreen`, parámetro de filtro de `MediaStatusServices.listForUser` |
| AC-2 | Controles de tipo/género/año/calificación de `LibraryFilters` + `MediaServices.getManyWithFilters` |
| AC-3 | `Checkbox` de disponibilidad de `LibraryFilters` + `MediaAvailabilityServices.getAvailableMediaIds` |
| AC-4 | `LibrarySearchInput` + consulta `ilike` en `getManyWithFilters` |
| AC-5 | Renderizado de `LibraryTable` (`DataTable`) y navegación por clic en fila |
| AC-6 | `EmptyLibraryState` |
| AC-7 | Round-trip de parámetros de búsqueda de la URL (resultados compartibles/guardables) |

---

## Prompt para Claude Code

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

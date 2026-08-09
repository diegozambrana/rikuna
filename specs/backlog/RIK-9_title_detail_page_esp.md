# RIK-9 — Ficha de título y marcado manual

> Documento de lectura. La fuente de verdad es `specs/backlog/RIK-9_title_detail_page.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

Construir la vista autenticada de detalle de título en `/titulo/[slug]` — poster, sinopsis, año, calificación/votos de IMDb, géneros, elenco, la calificación personal del usuario si existe, y una sección "Dónde ver" que lista las plataformas disponibles, resaltando la que coincide con la suscripción activa del usuario. Agregar los toggles manuales de visto/watchlist que escriben directamente en `user_media_status` sin depender de reimportar un CSV, y un estado degradado correcto para títulos `is_stub`.

- Marcar/desmarcar visto y agregar/quitar de watchlist desde la ficha debe actualizar `user_media_status` con `manually_edited = true` y `source = 'manual'`.
- "Dónde ver" solo lista plataformas con `is_available = true` para ese título, resaltando la que coincide con la suscripción activa.
- Un título con `is_stub = true` muestra un aviso de "información limitada" y no rompe el layout por falta de poster/sinopsis/elenco.
- La ficha debe ser alcanzable por click desde el panel, recomendaciones y listas propias — ninguna de las cuales existe todavía (RIK-7, RIK-8, RIK-10), así que el trabajo de este ticket es exponer la ruta/contrato estable que esas otras tickets enlazarán.
- La acción de marcado manual se diseña una sola vez, aquí, como la acción canónica que otras tickets (RIK-7, RIK-8) reutilizan — no debe aparecer lógica de mutación duplicada después.
- No existen comentarios de equipo más allá del texto del ticket y la nota de enrutamiento/arquitectura que acompañó esta solicitud de spec; ambos se tratan como autoritativos y se incorporan en Contexto/Decisiones más abajo.

---

## Contexto

### Ticket original

**RIK-9 — Ficha de título y marcado manual**

Descripción: Vista autenticada `/titulo/[slug]` con poster, sinopsis, año, calificación IMDb y votos, géneros, elenco, calificación personal si existe, y sección "Dónde ver" listando plataformas disponibles con enlace, destacando la que coincide con la suscripción activa. Incluye las acciones de marcado manual (visto/no visto, agregar/quitar de watchlist) sin depender de reimportar CSV, y el estado especial para títulos `is_stub`.

Criterios de aceptación:
- Marcar/desmarcar visto y agregar/quitar de watchlist desde la ficha actualiza `user_media_status` con `manually_edited = true` y `source = 'manual'`.
- La sección "Dónde ver" solo lista plataformas con `is_available = true` para ese título, y resalta la que coincide con la suscripción activa del usuario.
- Un título con `is_stub = true` muestra un aviso de "información limitada" y no rompe el layout por falta de poster/sinopsis/elenco.
- La ficha es alcanzable por click desde el panel, recomendaciones y listas propias.

Dependencias: `depends_on` RIK-1 (esquema), RIK-2 (autenticación/estructura de rutas), RIK-3 (ingesta de disponibilidad). Ninguna de las tres existe todavía en el repositorio al momento de escribir este documento — este documento está escrito contra su forma *documentada* (documento de esquema, `ARCHITECTURE.md`) y debe re-verificarse una vez que realmente aterricen.

### Comentarios del equipo

Un comentario acompañó el texto del ticket, autoritativo por sobre la descripción simple:

> "The manual-marking write should be the SHARED server action other tickets (RIK-7, RIK-8) also call — design it once here as the canonical `actions/mediaStatus/*` and have this ticket's constraints say so explicitly so later tickets don't duplicate it. Cross-check `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2 (`/titulo/[slug]`) for the two-column layout, cast avatars, "Tu servicio" badge, and stub-title placeholder treatment, and `RIKUNA-PRD-documento-especificacion-rikuna.md` Section 7.7."

Una segunda nota, estructural (surgida de la investigación de enrutamiento, no del autor del ticket), señala que `/titulo/[slug]` está documentado **dos veces** en los PRD — una vez como la ficha autenticada (documento de vistas §2.2) y otra como "la misma ficha, sin las acciones que requieren sesión" (documento de vistas §2.3) — y que se trata de la misma URL, no de dos rutas. Esa nota moldea directamente el Plan de implementación y las Decisiones más abajo.

El casing `actions/mediaStatus/*` del comentario del equipo **no** coincide con la convención de nombres real del código — ver tabla de discrepancias.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| Ticket dice | Realidad en el código | Impacto |
| --- | --- | --- |
| El comentario del equipo nombra la carpeta de acción canónica `actions/mediaStatus/*` (camelCase) | La tabla de Server Actions de `ARCHITECTURE.md` la nombra `media-status` (kebab-case), igual que toda carpeta hermana (`media`, `subscriptions`, `lists`, `imdb-import`, `recommendations`) | Usar `actions/media-status/` — una carpeta camelCase sería la única inconsistente en todo el árbol `actions/` |
| El PRD `vistas-y-estilo-rikuna.md` lista `/titulo/[slug]` bajo "Zona App (requiere sesión)" §2.2 **y** bajo "Zona Pública" §2.3 como si fueran dos pantallas independientes | Es la **misma URL**. El App Router de Next.js falla cuando dos `page.tsx` resuelven a la misma ruta a través de dos grupos de rutas, así que solo puede ser una ruta física con renderizado condicional por sesión — exactamente lo que la tabla de Features de `ARCHITECTURE.md` ya documenta: *"title — Detail view — shared between authenticated and public variants, with an `isPublicView` flag gating the personal-action buttons."* | Este ticket debe ubicar la página **fuera** del grupo de rutas `(app)` que redirige a todo el que no tenga sesión, y propagar una bandera `isPublicView` a través del componente compartido desde el día uno, aunque solo la rama autenticada tiene criterios de aceptación funcionales aquí |
| El PRD `vistas-y-estilo-rikuna.md` §1.3 documenta `components.json` como `"style": "lyra"` (shadcn basado en Radix) | El `components.json` real en el repositorio es `"style": "base-lyra"` — la variante Base UI, porque el proyecto migró fuera de Radix | Cualquier primitivo shadcn agregado para esta pantalla (`Avatar`, `Badge`, `Card`, `Alert`, `Skeleton`) debe ser la variante Base UI; no asumir APIs específicas de Radix |
| Los criterios del ticket dicen "alcanzable por click desde el panel, recomendaciones y listas propias" | Ninguna de `/panel`, `/recomendaciones`, `/mis-listas` existe todavía — son RIK-7, RIK-8, RIK-10, todas las cuales `depends_on` este ticket, no al revés | Este criterio solo puede verificarse como "la ruta existe y es un contrato estable al que otras tickets pueden apuntar con `<Link>`" — no un click-through real, imposible hasta que esas tickets aterricen |
| El ticket asume implícitamente que los datos de "Dónde ver" simplemente están disponibles | `media_availability` estará vacía hasta que RIK-3 (ingesta de catálogo) realmente corra — este ticket debe renderizar un **estado vacío** correcto, no asumir que existen filas | No es un bloqueante, pero el caso de plataformas vacías es parte de la barra de aceptación, no un caso extremo a omitir |

### Estado actual en la base de datos

No existe el directorio `supabase/migrations/` en el repositorio todavía (confirmado con `ls supabase/` — no encontrado). Todo lo siguiente es la forma **documentada** en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` v3, que se espera que RIK-1 implemente al pie de la letra. Re-verificar nombres de columnas/defaults contra la migración real una vez que RIK-1 se integre.

**`media_items`** (columnas relevantes): `id uuid pk`, `imdb_id varchar unique`, `type varchar`, `title varchar`, `year integer`, `description text`, `poster_url text`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `imdb_url text`, `is_stub boolean default false not null` (indexado vía `media_items_stub_idx` where `is_stub`), `slug varchar unique`.

**`genres` / `media_genres`**: `genres(id, name, slug)`; `media_genres(media_id, genre_id)` PK compuesta.

**`people` / `media_people`**: `people(id, imdb_id, name, photo_url)`; `media_people(media_id, person_id, role, character_name, sort_order)` — `role` es `'actor' | 'director' | 'writer' | 'creator'`, ordenado por `sort_order` vía `media_people_media_idx`.

**`platforms`**: `id, name, slug, logo_url, provider_id_movie, provider_id_tv`.

**`media_availability`**: `media_id, platform_id, country, url, offer_type default 'subscription'`, `is_available boolean default true not null`, `last_seen_at`, `last_snapshot_id`. Único en `(media_id, platform_id, country, offer_type)`. Indexado por `(platform_id, country, is_available)` y `(media_id) where is_available`.

**`user_subscriptions`**: `user_id, platform_id, country, started_on, ended_on` (`null` = activa/vigente). Un índice parcial único garantiza como máximo una fila activa por `(user_id, platform_id, country)`; un usuario **puede** tener varias suscripciones activas simultáneamente en distintas plataformas.

**`user_media_status`** — la tabla sobre la que este ticket escribe:

```sql
watched           boolean default false not null,
watched_at        timestamptz,
personal_rating   smallint,             -- 1-10, solo lectura en este ticket
want_to_watch     boolean default false not null,
want_added_at     timestamptz,
dismissed         boolean default false not null,
source            varchar default 'manual' not null,   -- 'manual' | 'imdb_ratings' | 'imdb_watchlist'
manually_edited   boolean default false not null,
constraint user_media_status_uq unique (user_id, media_id)
```

Reglas de negocio explícitas del documento de esquema (§5) que este ticket debe respetar:
- `watched` y `want_to_watch` son booleanos **independientes** — nunca modelar como un enum de estado único.
- `manually_edited = true` existe específicamente para que una reimportación de CSV posterior nunca sobrescriba una edición manual — cada escritura de este ticket debe fijarlo.
- No existe una tabla "watchlist"; "watchlist" en el ticket == `want_to_watch` + `want_added_at` en esta misma fila.

**RLS (documento de esquema §9)**: `media_items`, `genres`, `people`, `platforms`, `media_availability` son **de lectura pública**, incluso para el rol `anon` — la escritura es solo admin/ingesta. `user_media_status` es **solo del dueño** tanto para lectura como escritura (política `owner_all`, `auth.uid() = user_id`). Esto significa: las lecturas del catálogo pueden correr bajo cualquier cliente, pero la lectura/escritura de estado personal debe correr a través del cliente de Supabase con alcance de solicitud, atado a cookies — nunca `lib/supabase/admin.ts`.

**Uso en código**: ninguno todavía — `services/`, `actions/`, `types/`, `features/` son todos directorios vacíos/inexistentes en el repositorio hoy (confirmado vía `find`). Este ticket parte de cero para todos ellos, construido contra el esquema documentado de RIK-1 y el patrón de autenticación documentado de RIK-2.

### Lógica actual (title/ficha)

No existe implementación previa. Las declaraciones relevantes de `ARCHITECTURE.md` (verbatim, porque son las decisiones de diseño que sostienen este ticket):

> `(app)`: authenticated area — nav shell, `AuthCheck` using `createClient()` from `@/lib/supabase/server`, redirects unauthenticated users to `/auth/login`...
> `(public)`: unauthenticated, read-only content — **public lists and public title pages**. Must not sit inside `(app)` or be touched by its auth guard...
> `title` (features/) — Detail view — shared between authenticated and public variants, with an `isPublicView` flag gating the personal-action buttons.
> `AvailabilityBadge/` — shows which platform(s) a title is on, highlighting the user's active subscription.
> `media-status` (actions/) — Mark watched / want-to-watch / dismissed (`user_media_status` writes).
> marking watched revalidates `/panel`, `/biblioteca`, and the affected `/titulo/[slug]`.

`AvailabilityBadge` está explícitamente marcado como componente **compartido** (`components/`, no `features/`) precisamente porque la lógica de "Dónde ver" se reutilizará después en panel/recomendaciones — construirlo ahí ahora, no dentro de `features/title/`.

### Mapeo de campos solicitados

Todo campo que el ticket pide mostrar o escribir ya existe en el esquema documentado — no hay nada nuevo.

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Poster | imagen | `media_items.poster_url` (text, nullable) | ya existe (reusar) |
| Sinopsis | texto | `media_items.description` (text, nullable) | ya existe (reusar) |
| Año | número | `media_items.year` (integer, nullable) | ya existe (reusar) |
| Calificación IMDb + votos | número | `media_items.imdb_rating` (numeric 3,1), `media_items.imdb_votes` (integer) | ya existe (reusar) |
| Géneros | lista | `genres` vía `media_genres` | ya existe (reusar) |
| Elenco | lista | `people` vía `media_people` donde `role = 'actor'`, ordenado por `sort_order` | ya existe (reusar) |
| Calificación personal | número | `user_media_status.personal_rating` (smallint 1-10) — **solo lectura** en este ticket, no hay UI de calificación en los criterios | ya existe (reusar) |
| "Dónde ver" (plataformas + enlace) | lista | `media_availability` (`is_available = true`) unida a `platforms`, cruzada contra `user_subscriptions` (`ended_on is null`) para el resaltado | ya existe (reusar) |
| Marcado visto/no visto | escritura booleana | `user_media_status.watched` + `watched_at` | ya existe (reusar) |
| Agregar/quitar watchlist | escritura booleana | `user_media_status.want_to_watch` + `want_added_at` | ya existe (reusar) |
| Estado especial `is_stub` | lectura booleana | `media_items.is_stub` | ya existe (reusar) |

No se requiere ninguna migración para este ticket.

### Archivos impactados

**Rutas de app**
- `app/(public)/titulo/[slug]/page.tsx` — nuevo. La única ruta física para ambas variantes (ver Decisiones #1). Espera `params` (params async de Next.js 16), lee la sesión opcionalmente, llama a `actions/media/getTitleDetail`, renderiza `features/title/TitleDetail`.

**Actions**
- `actions/media/getTitleDetail.ts` (+ barrel `actions/media/index.ts`) — nuevo. Orquesta los tres servicios de abajo en un solo DTO; no requiere sesión (funciona para ambas variantes).
- `actions/media-status/index.ts` (+ funciones discretas) — nuevo. La acción de escritura **canónica** compartida: `markWatched`, `markNotWatched`, `addToWatchlist`, `removeFromWatchlist`. Verificación de sesión, propiedad vía `auth.uid()`, `revalidatePath` para `/panel`, `/biblioteca`, `/titulo/[slug]`.

**Services**
- `services/MediaServices/index.ts` — nuevo. `getBySlugWithDetails(supabase, slug)`: título + géneros + elenco.
- `services/MediaAvailabilityServices/index.ts` — nuevo. `getAvailableForMedia(supabase, mediaId)`: filas con `is_available = true` unidas a `platforms`.
- `services/MediaStatusServices/index.ts` — nuevo. `getForUser(supabase, userId, mediaId)` (lectura), `upsertStatus(supabase, userId, mediaId, patch)` (escritura, upsert sobre la restricción única `(user_id, media_id)`).
- `services/SubscriptionServices/index.ts` — nuevo, mínimo. Solo `getActiveForUser(supabase, userId)` — suficiente para calcular la coincidencia de "Tu servicio". El CRUD completo de suscripciones pertenece a RIK-6; señalar esto para que RIK-6 extienda en vez de duplicar este archivo.
- `services/index.ts` — barrel nuevo, exporta todo lo anterior.

**Features**
- `features/title/TitleDetail.tsx` — nuevo. Componente de servidor, layout de dos columnas (poster + info) según el documento de vistas §2.2.
- `features/title/TitleActions.tsx` — nuevo. Componente cliente: botones de toggle visto + watchlist, `useTransition`, llama a `actions/media-status` directamente, feedback con toast de Sonner.
- `features/title/CastList.tsx` — nuevo. Fila de avatares del elenco.
- `features/title/WhereToWatch.tsx` — nuevo. Sección "Dónde ver", compone `components/AvailabilityBadge`.
- `features/title/StubNotice.tsx` — nuevo. `Alert` para `is_stub = true`.

**Componentes (compartidos)**
- `components/AvailabilityBadge/AvailabilityBadge.tsx` — nuevo. Promovido deliberadamente a `components/` (no `features/title/`) según la propia sección de UI compartida de `ARCHITECTURE.md`, para que RIK-7/RIK-8 lo reutilicen en vez de reconstruirlo.
- `components/ui/*` — agregar vía CLI de `shadcn` (variante Base UI / `base-lyra`, ya configurada en `components.json`): `avatar`, `badge`, `card`, `alert`, `skeleton`. Solo `button.tsx` existe hoy.

**Types**
- No se necesita ningún tipo base nuevo — `MediaItem`, `Genre`, `Person`, `Platform`, `MediaAvailability`, `UserSubscription`, `UserMediaStatus` se esperan del `types/index.ts` de RIK-1. Definir la forma de lectura agregada (`TitleDetailDTO` o similar) localmente en `actions/media/getTitleDetail.ts` en vez de agregarla al barrel compartido — es un compuesto específico de esta vista, no respaldado por una tabla.

**Tests**
- No hay framework de testing configurado en `package.json` todavía (sin `jest`/`vitest`). No agregar un framework nuevo como parte de este ticket; anotar en el log de trabajo dónde deberían vivir los tests una vez que exista uno (co-ubicados en `__tests__` junto a `services/MediaStatusServices/`).

### Decisiones tomadas

1. **Ubicación física de la ruta: `app/(public)/titulo/[slug]/page.tsx`, no `(app)`.** Justificación: `ARCHITECTURE.md` asigna explícitamente "public title pages" al grupo `(public)`; Next.js no puede resolver la misma ruta desde dos grupos; y la tabla de Features ya documenta un único componente compartido controlado por `isPublicView`. La página realiza su propia lectura de sesión opcional (`supabase.auth.getUser()`) en vez de depender de la redirección general de `(app)`. **Default no confirmado** — fundamentado en el propio texto de `ARCHITECTURE.md`, pero ningún ticket detalló explícitamente la mecánica de enrutamiento. Registrado en `<clarify_before_coding>`.
2. **El chrome de navegación autenticado se renderiza directamente desde la página, no se hereda de un layout.** Como `(public)/layout.tsx` está documentado como mínimo (solo logo + enlaces de auth), la rama autenticada de `/titulo/[slug]` debe importar y renderizar `components/layout/Header` / `Nav` ella misma cuando hay sesión, en vez de asumir que un layout padre los provee. **Default no confirmado.**
3. **Solo la rama autenticada es funcionalmente requerida por los cuatro criterios de este ticket.** La bandera `isPublicView` y su ruta de renderizado de solo lectura se construyen estructuralmente ahora (botones ocultos/redirigiendo a login), pero el QA manual completo de la rama anónima se difiere a RIK-11, ya que RIK-10 (compartir listas) no ha aterrizado y no hay forma de llegar a esta página sin sesión salvo entrando la URL directamente. Default de bajo riesgo, confirmado.
4. **La carpeta de acción canónica es `actions/media-status/`** (kebab-case), corrigiendo el casing `actions/mediaStatus/*` del comentario del equipo para que coincida con la convención documentada en `ARCHITECTURE.md`.
5. **Las lecturas de detalle de título pasan por `actions/media/getTitleDetail.ts`**, siguiendo la asignación explícita de `ARCHITECTURE.md` de "Title detail reads" a la carpeta de actions `media`, en vez de que el componente de servidor consulte los servicios directamente (patrón documentado solo para la ruta de lectura pública de listas).
6. **Sin store de Zustand para esta pantalla.** Los dos botones de toggle usan `useTransition` y llaman a la server action directamente; un store agregaría indirección que `ARCHITECTURE.md` no exige para cada feature (dice que los stores se usan "p. ej." para filtros/banderas de UI, no de forma universal).
7. **El criterio "alcanzable por click desde panel, recomendaciones y listas propias" se verifica como una comprobación de contrato de ruta**, no un click-through real, ya que ninguna de esas pantallas de origen existe todavía. Registrado explícitamente para que el reporte de verificación no exagere lo que fue probado.
8. **`personal_rating` es de solo lectura en este ticket.** Los propios criterios de aceptación del ticket solo piden toggles de visto/watchlist; no hay UI de calificación en el alcance.

### Fuera de alcance

- Construir `/panel`, `/recomendaciones`, `/mis-listas` o `MediaCard` — son RIK-7, RIK-8, RIK-10 y no dependen de este ticket; este ticket solo garantiza el contrato `/titulo/[slug]` al que ellas enlazarán.
- Pulido completo de la experiencia anónima/sin sesión, incluyendo un CTA de "crea tu propia lista" — diferido a RIK-11.
- CRUD completo de `user_subscriptions` (activar/cerrar/historial) — lo posee RIK-6; este ticket solo agrega la lectura mínima de suscripción activa necesaria para el resaltado de "Tu servicio".
- Enriquecimiento de stubs (completar poster/sinopsis/elenco para títulos `is_stub`) — el documento de esquema §11.3 lo señala como un proceso de backend sin resolver, no perteneciente a ningún ticket actual; este ticket solo muestra el aviso.
- Agregar a una lista personal ("agregar a lista") — mencionado en la lista de acciones del PRD para la ficha (documento de especificación §7.7) pero no en los criterios de aceptación reales de este ticket, y depende de `user_lists`/`list_items` (RIK-10). Se deja un TODO visible en `TitleActions.tsx`, sin implementar.
- Un framework de testing — no existe en el repositorio; no se introduce aquí.

---

## Plan de implementación

**Objetivo:** entregar la ruta única `/titulo/[slug]`, consciente de la sesión, con el comportamiento autenticado completo (lectura + escrituras manuales de visto/watchlist + resaltado de disponibilidad + manejo de stub), construida de modo que la variante pública ya documentada solo necesite agregar una rama de contenido después, no una reubicación.

**En alcance:**
1. Servicios: `MediaServices.getBySlugWithDetails`, `MediaAvailabilityServices.getAvailableForMedia`, `MediaStatusServices.getForUser` + `upsertStatus`, `SubscriptionServices.getActiveForUser`.
2. Actions: `actions/media/getTitleDetail.ts` (orquestación de lectura), `actions/media-status/` (acción de escritura canónica — `markWatched`, `markNotWatched`, `addToWatchlist`, `removeFromWatchlist`), cada una fijando `source = 'manual'`, `manually_edited = true`, con `revalidatePath('/panel')`, `revalidatePath('/biblioteca')`, `revalidatePath('/titulo/[slug]')`.
3. Ruta: `app/(public)/titulo/[slug]/page.tsx` — `params` async, lectura de sesión opcional, renderiza `features/title/TitleDetail` con `isPublicView`.
4. Componentes de feature: `TitleDetail`, `TitleActions` (cliente), `CastList`, `WhereToWatch`, `StubNotice`.
5. Componente compartido: `components/AvailabilityBadge/AvailabilityBadge.tsx`.
6. Adiciones de shadcn (Base UI/`base-lyra`): `avatar`, `badge`, `card`, `alert`, `skeleton`.

**Fuera de alcance:** pantallas de panel/recomendaciones/listas, CRUD completo de suscripciones, enriquecimiento de stubs, acción de agregar a lista, framework de testing — ver la sección de Fuera de alcance arriba para las razones.

**Riesgos clave / compatibilidad:**
- La ubicación del grupo de rutas (`(public)` vs. `(app)`) es el mayor riesgo estructural — si RIK-2 aterriza con un límite `(app)`/`(public)` distinto al documentado aquí, esta ruta podría necesitar moverse. Señalado con fuerza en `<clarify_before_coding>`.
- `media_availability` estará legítimamente vacía hasta que RIK-3 corra; "Dónde ver" debe renderizar un estado vacío correcto y no roto.
- RLS: las lecturas/escrituras de estado personal deben usar el cliente de servidor atado a cookies, nunca `admin.ts`, o cada escritura fallará silenciosamente bajo RLS.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1/2 | `markWatched`/`markNotWatched` en `actions/media-status/`, upsert de `watched`, `source='manual'`, `manually_edited=true` |
| AC-3/4 | `addToWatchlist`/`removeFromWatchlist` en `actions/media-status/`, misma garantía sobre `want_to_watch` |
| AC-5 | `MediaAvailabilityServices.getAvailableForMedia` filtra `is_available = true` |
| AC-6 | `WhereToWatch` + `AvailabilityBadge`, cruzando con `SubscriptionServices.getActiveForUser` |
| AC-7 | `StubNotice` + renderizado defensivo (`poster_url`/`description`/elenco todos opcionales) en `TitleDetail` |
| AC-8 | Ruta estable `/titulo/[slug]` confirmada alcanzable por navegación directa (click-through diferido según Decisión #7) |

---

## Prompt para Claude Code

```xml
<task id="RIK-9" title="Ficha de título y marcado manual" depends_on="RIK-1, RIK-2, RIK-3">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, route groups ((app)/(public)/(auth)), auth
      boundaries, ingestion vs user actions, Server Actions table, Services table, Features table.
      Pay special attention to the line: "title — Detail view — shared between authenticated and public
      variants, with an isPublicView flag gating the personal-action buttons" and the (public) group's
      description ("public lists and public title pages").</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data.
      Read node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
      before writing the page component: `params` is a Promise and must be awaited (or unwrapped with
      `use()` in a Client Component). Read
      node_modules/next/dist/docs/01-app/02-guides/server-actions.md before writing actions/media-status/ —
      note the session/ownership guidance (derive identity from the session, never trust an id owner
      field the client claims).</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md Section 7.7 ("Ficha de título") — content
      and action list for this screen.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md Sections 1 (design system: style is documented as
      "lyra" there but the REAL components.json says "base-lyra" — see ground truth notes), 2.2
      (authenticated ficha: two-column layout, cast avatars, "Tu servicio" badge, stub placeholder), and
      2.3 (public variant note — same ficha, no session-only actions).</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md Sections 2 (media_items, genres, people), 3
      (platforms, media_availability), 4 (user_subscriptions), 5 (user_media_status — read this one
      fully, it has the business rules this ticket must not violate), and 9 (RLS table + the owner_all
      policy pattern).</item>
    <item>components.json — confirm the real shadcn config (style, baseColor, aliases) before adding any
      component.</item>
    <item>app/layout.tsx — existing root layout conventions (font variables, `cn`, `LayoutProps<'/'>`
      typed helper) to match when creating nested layouts/pages.</item>
    <item>supabase/migrations/ — read the latest timestamped file(s) once RIK-1 has landed. Confirm real
      column names/types/defaults for media_items, genres, media_genres, people, media_people, platforms,
      media_availability, user_subscriptions, user_media_status BEFORE writing any query. Do not trust
      this document's schema recall over the actual migration file.</item>
    <item>types/index.ts (from RIK-1) — reuse the existing MediaItem, Genre, Person, Platform,
      MediaAvailability, UserSubscription, UserMediaStatus types. Do not redefine them.</item>
    <item>lib/supabase/server.ts and lib/supabase/client.ts (from RIK-2) — the request-scoped Supabase
      client factories. lib/supabase/admin.ts (from RIK-2) must NOT be imported anywhere in this ticket's
      code — it is ingestion-only.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna is a personal streaming-rotation planner. The title detail ("ficha") screen at
    /titulo/[slug] is where a user reads everything about one title (poster, synopsis, year, IMDb
    rating/votes, genres, cast, their own rating if any) and decides what to do about it: mark it
    watched, add/remove it from their watchlist, and see which of their currently-paid streaming
    services actually carries it.

    The database (RIK-1, documented in specs/RIKUNA-PRD-schema-basedatos-rikuna.md) already has every
    column this screen needs — nothing new is created by this ticket:
    - media_items: imdb_id, type, title, year, description, poster_url, imdb_rating, imdb_votes,
      imdb_url, is_stub (boolean, default false), slug (unique).
    - genres / media_genres, people / media_people (role='actor' for cast, ordered by sort_order).
    - platforms, media_availability (media_id, platform_id, country, url, offer_type, is_available,
      unique on media_id+platform_id+country+offer_type).
    - user_subscriptions (user_id, platform_id, country, started_on, ended_on — null ended_on = active;
      a user can have several concurrently active subscriptions on different platforms).
    - user_media_status (user_id, media_id — unique together; watched, watched_at, personal_rating,
      want_to_watch, want_added_at, dismissed, source default 'manual', manually_edited default false).

    "Watchlist" in this ticket's language IS want_to_watch/want_added_at on user_media_status — there is
    no separate watchlist table. watched and want_to_watch are independent booleans, never a single
    status enum: a title can be both watched=true and want_to_watch=true simultaneously (the schema doc
    explicitly allows this and says "watched wins" for exclusion from recommendation queries — not
    relevant to this ticket, but do not "clean up" want_to_watch when marking watched).

    The write action this ticket builds (actions/media-status/) is the SHARED, canonical mutation point.
    RIK-7 (panel) and RIK-8 (discovery recommendations) will later call the exact same exported
    functions from their own client components — do not build a parallel/duplicate mutation path for
    them to reinvent; export cleanly-named functions from actions/media-status/index.ts.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ does not exist in the repo at spec-writing time. This ticket depends on
      RIK-1 landing first. Re-read the actual migration before writing any query — do not assume the
      schema doc's SQL is byte-identical to what RIK-1 shipped.</note>
    <note>There is no "watchlist" table. Watchlist add/remove writes want_to_watch + want_added_at on
      user_media_status, the same row watched/watched_at lives on (unique per user_id+media_id).</note>
    <note>Every manual write (watched toggle, watchlist toggle) MUST set source = 'manual' AND
      manually_edited = true on the row, every time — not just on first insert. This is what protects the
      row from being silently overwritten by a future IMDb CSV reimport (RIK-4).</note>
    <note>user_media_status has RLS restricted to the owner (auth.uid() = user_id) for BOTH read and
      write. Every query/mutation against it must run through the request-scoped, cookie-bound Supabase
      client (lib/supabase/server.ts's createClient()) so auth.uid() resolves inside Postgres. Do NOT use
      lib/supabase/admin.ts anywhere in actions/ or services/ touched by this ticket — that client is
      reserved for ingestion/ only and bypasses RLS entirely.</note>
    <note>media_items, genres, people, platforms, media_availability are PUBLICLY readable per RLS
      (including the anon role) — reading them does not require a session. Only the personal-status join
      (user_media_status) and the active-subscription lookup (user_subscriptions) require one.</note>
    <note>media_items.is_stub is a real, already-indexed boolean column (media_items_stub_idx WHERE
      is_stub) — treat it as a first-class UI state per ARCHITECTURE.md's "Conventions worth preserving"
      section, not an edge case. poster_url, description, and any media_people rows can all be NULL/empty
      simultaneously on a stub row; the layout must not crash or leave visible gaps.</note>
    <note>components.json's real "style" value is "base-lyra" (the Base UI variant of shadcn), NOT "lyra"
      as specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md Section 1.3 documents — the project migrated off
      Radix. Add shadcn components with the project's actual configured style; do not hand-write
      Radix-specific primitive APIs.</note>
    <note>/titulo/[slug] is documented in the PRDs as if it were two screens (authenticated §2.2 vs.
      public §2.3 of vistas-y-estilo-rikuna.md), but it is ONE URL. Next.js cannot resolve the same path
      from two route groups. Place the single page.tsx under app/(public)/titulo/[slug]/ — ARCHITECTURE.md
      explicitly assigns "public title pages" to the (public) group — and make the page itself decide
      what to render based on whether a session exists, rather than relying on a route group's layout to
      gate it. Do NOT create app/(app)/titulo/[slug]/page.tsx — that would collide with the (public) one
      if it also existed, and this ticket standardizes on (public) as the single physical location.</note>
    <note>(public)'s layout is documented as intentionally minimal (logo + auth links, no nav sidebar).
      When a session IS present, this page must render the authenticated nav chrome itself (import
      components/layout/Header and components/layout/Nav directly), because it will not inherit them from
      a (public) parent layout.</note>
    <note>Next.js 16: the `params` prop passed to a page.tsx is a Promise — `const { slug } = await
      params` in the Server Component (or `use(params)` if it were a Client Component, which it is not
      here).</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="Services">
      <item>Create services/MediaServices/index.ts exporting class MediaServices with method
        getBySlugWithDetails(supabase, slug): fetches the media_items row by slug, plus its genres (via
        media_genres join) and cast (media_people where role='actor', ordered by sort_order). Returns null
        if no row matches the slug (the page must 404 in that case).</item>
      <item>Create services/MediaAvailabilityServices/index.ts exporting class MediaAvailabilityServices
        with method getAvailableForMedia(supabase, mediaId): returns media_availability rows where
        is_available = true for that media_id, joined to platforms for name/slug/logo_url/url.</item>
      <item>Create services/MediaStatusServices/index.ts exporting class MediaStatusServices with:
        getForUser(supabase, userId, mediaId) — returns the existing row or null;
        upsertStatus(supabase, userId, mediaId, patch) — upserts on the (user_id, media_id) unique
        constraint, always forcing source='manual' and manually_edited=true on the written row regardless
        of what patch contains for those two fields.</item>
      <item>Create services/SubscriptionServices/index.ts exporting class SubscriptionServices with
        getActiveForUser(supabase, userId): returns all user_subscriptions rows where ended_on is null for
        that user (a user may have several active subscriptions across platforms). This is a MINIMAL
        service for this ticket's "Tu servicio" highlight only — do not build activate/close/history
        methods here, that is RIK-6's scope; leave the file easy for RIK-6 to extend.</item>
      <item>Create or extend services/index.ts as the barrel exporting all of the above.</item>
    </phase>

    <phase title="Actions — reads">
      <item>Create actions/media/getTitleDetail.ts (and actions/media/index.ts barrel if it doesn't
        exist) exporting an async function getTitleDetail(slug: string) that: creates the request-scoped
        Supabase client; reads the current user via supabase.auth.getUser() (optional — do NOT redirect if
        absent, this function must work for both the authenticated and future public branch); calls
        MediaServices.getBySlugWithDetails, MediaAvailabilityServices.getAvailableForMedia, and — only
        when a user is present — MediaStatusServices.getForUser and SubscriptionServices.getActiveForUser;
        composes and returns a single DTO (define its shape locally in this file, e.g. TitleDetailDTO) that
        includes: the media item, genres, cast, availability rows, the user's personal status (or null),
        the user's active subscriptions (empty array if none/no session), and isPublicView: boolean (true
        when there is no session). Return null if the slug does not match any media_items row.</item>
    </phase>

    <phase title="Actions — writes (the canonical shared action)">
      <item>Create actions/media-status/index.ts with the "use server" directive at the top, exporting
        four functions: markWatched(mediaId: string), markNotWatched(mediaId: string),
        addToWatchlist(mediaId: string), removeFromWatchlist(mediaId: string). Each: reads the session via
        the request-scoped client and returns/throws an explicit unauthorized result if there is none
        (never trust a userId passed from the client — derive it from the session only); calls
        MediaStatusServices.upsertStatus with the appropriate patch (markWatched: watched=true,
        watched_at=now(); markNotWatched: watched=false; addToWatchlist: want_to_watch=true,
        want_added_at=now(); removeFromWatchlist: want_to_watch=false), always forcing source='manual' and
        manually_edited=true inside the service, not just in the action; calls revalidatePath for '/panel',
        '/biblioteca', and the current '/titulo/[slug]' path after a successful write.</item>
      <item>These four exports are the ONLY place user_media_status is written to from the UI layer for
        this ticket. Do not add a second mutation path anywhere in features/title/.</item>
    </phase>

    <phase title="Route">
      <item>Create app/(public)/titulo/[slug]/page.tsx as an async Server Component. Await params to get
        slug. Call getTitleDetail(slug); call notFound() from next/navigation if it returns null. Render
        features/title/TitleDetail with the resulting DTO as props.</item>
    </phase>

    <phase title="Features">
      <item>Create features/title/TitleDetail.tsx (Server Component): two-column layout (poster + info)
        per vistas-y-estilo-rikuna.md Section 2.2 — poster (or placeholder when poster_url is
        null/is_stub), title, year, IMDb rating Badge + vote count, genre badges, synopsis (or omitted
        gracefully when null), CastList, personal rating display if personalStatus?.personal_rating is
        present, StubNotice when is_stub, WhereToWatch section, and TitleActions. When isPublicView is
        true, render TitleActions in a read-only mode (buttons link to /auth/login instead of firing the
        action) — this branch does not need full polish per this ticket's scope, just must not crash or
        expose write controls to an anonymous visitor.</item>
      <item>Create features/title/TitleActions.tsx as a Client Component: two toggle controls (watched,
        watchlist) reflecting the current personalStatus, using useTransition to call
        markWatched/markNotWatched/addToWatchlist/removeFromWatchlist from actions/media-status directly,
        with Sonner toast feedback on success/error. Accepts an isPublicView prop; when true, render
        disabled/login-linking buttons instead of wiring the server actions.</item>
      <item>Create features/title/CastList.tsx: horizontal-scroll row of cast Avatars (name +
        character_name), gracefully rendering nothing (not a broken layout) when the cast array is
        empty.</item>
      <item>Create features/title/WhereToWatch.tsx: renders the "Dónde ver" heading and, for each
        available platform row, a components/AvailabilityBadge instance; renders a clear, non-broken empty
        state when the availability array is empty (do not hide the whole section silently — say
        something like "Sin disponibilidad confirmada por ahora").</item>
      <item>Create features/title/StubNotice.tsx: an Alert with Spanish copy substantially similar to
        "Información limitada — este título se completará pronto", rendered only when is_stub is
        true.</item>
    </phase>

    <phase title="Shared component">
      <item>Create components/AvailabilityBadge/AvailabilityBadge.tsx: takes one availability row
        (platform name/slug/url) plus a boolean isActiveSubscription; renders a Badge/Button-like element
        linking to the platform url (or a general platforms fallback if url is null), visually
        highlighted (e.g. a distinct Badge variant plus a "Tu servicio" label) when
        isActiveSubscription is true. This component must be usable standalone by future tickets
        (RIK-7/RIK-8) — no title-page-specific coupling in its props.</item>
    </phase>

    <phase title="UI primitives">
      <item>Add the shadcn components this screen needs via the CLI, using the project's real configured
        style (base-lyra) and baseColor (mist) from components.json: avatar, badge, card, alert, skeleton.
        Do not hand-author Radix-based primitives.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Clicking "marcar como visto" on the ficha for a title with no prior
      user_media_status row creates one with watched=true, source='manual', manually_edited=true.
      Verify: `select watched, source, manually_edited from user_media_status where user_id = :uid and
      media_id = :mid;` returns (true, 'manual', true).</criterion>
    <criterion id="AC-2">Clicking the same control again (un-marking) updates the existing row to
      watched=false while source stays 'manual' and manually_edited stays true. Verify: same query, watched
      now false, other two columns unchanged.</criterion>
    <criterion id="AC-3">Clicking "agregar a watchlist" sets want_to_watch=true, want_added_at not null,
      source='manual', manually_edited=true. Verify: equivalent SQL query on want_to_watch/want_added_at.</criterion>
    <criterion id="AC-4">Clicking "quitar de watchlist" sets want_to_watch=false while manually_edited
      stays true and source stays 'manual'. Verify: same query pattern.</criterion>
    <criterion id="AC-5">The "Dónde ver" section renders exactly the platforms whose media_availability
      row has is_available = true for that media_id, and none with is_available = false. Verify: compare
      rendered platform names against `select p.name from media_availability ma join platforms p on
      p.id = ma.platform_id where ma.media_id = :mid and ma.is_available;` — must match exactly; seed one
      is_available=false row for the same title and confirm it is absent from the UI.</criterion>
    <criterion id="AC-6">Among the platforms shown, the one matching a row in the user's active
      user_subscriptions (same platform_id + country, ended_on is null) is visually distinguished (e.g. a
      "Tu servicio" badge). Verify: seed an active subscription matching one listed platform and confirm
      only that one AvailabilityBadge renders in its highlighted state.</criterion>
    <criterion id="AC-7">A title with is_stub = true and null poster_url/description and no
      media_people rows renders the "información limitada" notice and a complete, non-broken layout
      (placeholder poster, no missing-section gaps, no thrown error). Verify: seed such a row, navigate to
      its /titulo/[slug], confirm no console/render error and the notice is visible.</criterion>
    <criterion id="AC-8">The ficha is reachable at a stable /titulo/[slug] URL for any existing slug via
      direct navigation, and the page composes cleanly enough (typed props, exported component) that a
      future <Link href={`/titulo/${slug}`}> from another screen requires no changes to this route.
      Verify: direct navigation succeeds; note in the verification report that click-through from
      panel/recommendations/lists cannot be tested because those screens do not exist yet (RIK-7, RIK-8,
      RIK-10).</criterion>
    <criterion id="AC-9">actions/media-status/index.ts is the only file in the diff that writes to
      user_media_status, and its four exported functions are the ones features/title/TitleActions.tsx
      calls — no parallel/duplicate mutation logic exists elsewhere in the diff. Verify: grep the diff for
      "user_media_status" writes; only services/MediaStatusServices/index.ts (the data-access layer) and
      actions/media-status/index.ts (the orchestration layer) should reference it for writes.</criterion>
    <criterion id="AC-10">Calling any of the four actions/media-status functions without a valid session
      does not write to user_media_status (returns/throws an explicit unauthorized result instead).
      Verify: read the auth-check code path in actions/media-status/index.ts and confirm it runs before
      any service call, or exercise it directly with no session cookie present.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new migration under supabase/migrations/ — every field this ticket needs
      already exists per RIK-1's documented schema. If, after reading the real migration, a genuinely
      required column is missing, stop and report it rather than guessing a shape.</item>
    <item>Do NOT rename or drop any existing column, especially user_media_status.source,
      user_media_status.manually_edited, or media_items.is_stub.</item>
    <item>Do NOT import lib/supabase/admin.ts from anywhere touched by this ticket (actions/, services/,
      features/, app/(public)/titulo/). It is ingestion-only.</item>
    <item>Do NOT create app/(app)/titulo/[slug]/page.tsx. The single physical route lives at
      app/(public)/titulo/[slug]/page.tsx per the ground truth notes above.</item>
    <item>Do NOT build a second mutation path for watched/watchlist state outside
      actions/media-status/index.ts's four exported functions — that folder is the canonical, shared
      action other tickets will call.</item>
    <item>Do NOT add a rating-input UI — personal_rating is read-only display in this ticket.</item>
    <item>Do NOT implement /panel, /recomendaciones, /mis-listas, MediaCard, or full
      user_subscriptions CRUD — out of scope, owned by other tickets.</item>
    <item>Do NOT hand-write Radix-based component internals — this project's shadcn style is
      "base-lyra" (Base UI), confirmed in the real components.json.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
  </constraints>

  <out_of_scope>
    <item>Panel, recommendations, and mis-listas screens (RIK-7, RIK-8, RIK-10) — this ticket only
      guarantees the /titulo/[slug] route contract they will link to.</item>
    <item>Full anonymous/no-session UX polish for the public variant, including a "create your own list"
      CTA — deferred to RIK-11.</item>
    <item>user_subscriptions activate/close/history management — RIK-6.</item>
    <item>Stub enrichment process that fills in poster/synopsis/cast for is_stub titles — unresolved
      backend process per schema doc Section 11.3, not owned by any current ticket.</item>
    <item>"Agregar a lista" action from the ficha — depends on RIK-10 (user_lists/list_items); leave a
      visible TODO hook in TitleActions.tsx, do not implement the dialog/logic.</item>
    <item>Introducing a test framework — none exists in the repo; note where tests should live once one
      is added, do not add one now.</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/MediaServices/index.ts — `class MediaServices { constructor(private supabase:
      SupabaseClient) {} async getBySlugWithDetails(slug: string): Promise&lt;TitleWithDetails | null&gt;
      {...} }` (name the local composite type here, do not add it to types/index.ts).</item>
    <item>services/MediaStatusServices/index.ts — `async upsertStatus(userId: string, mediaId: string,
      patch: Partial&lt;Pick&lt;UserMediaStatus, 'watched'|'watched_at'|'want_to_watch'|'want_added_at'&gt;&gt;)`
      — always spreads `{ ...patch, source: 'manual', manually_edited: true }` into the upsert payload,
      `.upsert(..., { onConflict: 'user_id,media_id' })`.</item>
    <item>actions/media-status/index.ts — each exported function signature is
      `export async function markWatched(mediaId: string): Promise&lt;{ ok: true } | { ok: false; error:
      string }&gt;` (same shape for the other three) so TitleActions.tsx can branch on the result for the
      toast.</item>
    <item>app/(public)/titulo/[slug]/page.tsx — `export default async function TituloPage({ params }:
      PageProps&lt;'/titulo/[slug]'&gt;) { const { slug } = await params; ... }` — use the generated
      PageProps helper (per node_modules/next/dist/docs Next 16 typegen convention) rather than a hand
      written Promise type when possible; fall back to an explicit `Promise&lt;{ slug: string }&gt;` type
      if `next typegen` output isn't available in this environment.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created and wired together end-to-end (route ->
      feature -> action -> service -> Supabase).</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one, but note in the work log where MediaStatusServices
      tests should live once a framework is introduced.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether app/(public)/titulo/[slug]/page.tsx (this ticket's chosen location) matches how RIK-2
      actually structures the (app)/(public)/(auth) route groups once it lands — if RIK-2's real auth
      guard is implemented differently (e.g. a per-route allowlist inside a single root layout instead of
      route-group-level guards), adjust the physical file location accordingly but keep the
      isPublicView-gated single-component contract. Default if unconfirmed: proceed with
      app/(public)/titulo/[slug]/page.tsx as specified.</item>
    <item>Whether the authenticated nav chrome (Header/Nav) should be imported directly into this page
      (this ticket's default, since (public)'s layout is minimal) or whether RIK-2 introduces a different
      shared-chrome mechanism. Default if unconfirmed: import components/layout/Header and
      components/layout/Nav directly in the authenticated branch.</item>
    <item>Naming of the four actions/media-status exports (markWatched/markNotWatched/addToWatchlist/
      removeFromWatchlist) — cheap to rename later since this is the only ticket calling them so far.
      Default if unconfirmed: keep the names as specified so RIK-7/RIK-8 can grep for them.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-10): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-9: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-9_title_detail_page.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to title_detail_page, matching specs/backlog/RIK-9_title_detail_page.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-9_title_detail_page.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: migration / types / services / actions / ingestion / features / components / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
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
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; optional "Screenshots" section when visuals matter (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Translate them into product language (for example say "the title page" instead of naming the component, "the watched toggle" instead of naming columns).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots — include a "## Screenshots" section, since this ticket has user-visible UI: list 1-4 numbered items, each with screen/area name, auth state, and what the screenshot should show (e.g. "Title page — with active subscription: /titulo/[a known slug] showing the highlighted 'Tu servicio' platform badge"; "Title page — stub title: the limited-information notice with placeholder poster"). Suggest at most 4.</item>
      <item>Do NOT embed images in the markdown — attachments are added by the human. Prefix each screenshot line with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works.</item>
      <item>This ticket is Mixed UI + Database — include "## Prerequisites" (dev server running, a logged-in test user, at least one seeded media_items row with a slug, ideally one is_stub=true row and one row with a matching media_availability + user_subscriptions pair), then "## UI validation" (numbered steps: navigate to /titulo/[known-slug], toggle watched, toggle watchlist, observe toast + button state change, navigate to the stub-title slug and observe the notice, observe the "Tu servicio" highlighted badge), then "## Database validation" (runnable read-only SQL against user_media_status and media_availability matching the acceptance criteria queries above, using the real table/column names), then "## Expected outcome" (bullets tying back to AC-1 through AC-10).</item>
      <item>Use concrete app paths: /titulo/[slug]. Note that /panel, /recomendaciones, /mis-listas are not yet built, so entry points other than direct URL navigation cannot be manually tested for this ticket.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```

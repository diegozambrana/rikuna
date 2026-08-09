# RIK-7 — Panel principal ("Qué ver este mes")

> Documento de lectura en español. La fuente de verdad es `specs/backlog/RIK-7_monthly_watch_panel.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

La pantalla de aterrizaje de Rikuna tras iniciar sesión, `/panel`, debe mostrar el cruce central del producto: títulos que están simultáneamente (1) en la watchlist del usuario, (2) disponibles en un servicio de streaming al que el usuario realmente está suscrito ahora mismo, y (3) aún no vistos ni descartados — ordenados por calificación IMDb. Esta es la consulta dada verbatim en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 8.1. La pantalla necesita un encabezado que muestre la(s) suscripción(es) activa(s), un contador de coincidencias exactas, una cuadrícula de posters con badge de calificación, una acción en línea de "marcar visto" que quita la tarjeta sin recargar la página completa, y un estado vacío que apunte a `/suscripciones` cuando no hay suscripción activa.

- La cuadrícula solo muestra: `want_to_watch = true`, no `watched`, no `dismissed`, y disponible (`is_available = true`) en una plataforma+país al que el usuario está suscrito actualmente (`user_subscriptions.ended_on is null`).
- El contador debe ser exactamente igual a la cantidad de tarjetas renderizadas, actualizado en vivo tras cada tarjeta que se quita.
- "Marcar visto" desde una tarjeta la quita de la cuadrícula sin recargar la página.
- Sin suscripción activa → estado vacío con botón directo a `/suscripciones`.
- La carga inicial debe sentirse instantánea incluso con un historial personal de varios miles de filas — verificar con volumen realista sembrado, no solo un puñado de filas.
- Comentario del equipo (autoritativo): la escritura de "marcar visto" debe reutilizar exactamente el mismo patrón de escritura de `user_media_status` que también necesitará RIK-9 (ficha de título), como una sola acción de servidor compartida en vez de dos implementaciones independientes.

---

## Contexto

### Ticket original

**RIK-7 — Panel principal ("Qué ver este mes")**

**Descripción:** Vista de aterrizaje `/panel` con el cruce central del producto: watchlist ∩ disponible en el servicio activo ∩ no visto, ordenado por calificación IMDb (consulta 8.1 del esquema). Incluye encabezado con servicio/país activo, contador de coincidencias, cuadrícula de resultados y acción de marcar visto directo desde la tarjeta.

**Criterios de aceptación:**

- La cuadrícula solo muestra títulos que están en la watchlist del usuario, disponibles (`is_available = true`) en su suscripción activa, y no marcados como vistos ni descartados.
- El contador refleja exactamente la cantidad de tarjetas mostradas.
- Marcar "visto" desde una tarjeta la quita de la lista sin recargar la página completa.
- Sin suscripción activa declarada, se muestra un estado vacío con botón directo a `/suscripciones`.
- La carga inicial se siente instantánea con un historial de varios miles de títulos (verificar con datos de prueba de volumen realista).

La redacción propia del ticket dice "su suscripción activa" (singular). Esto **no** coincide con el esquema real: `user_subscriptions` permite explícitamente múltiples filas activas simultáneas para distintos pares plataforma/país (ver `user_subscriptions_active_uq`, un índice único parcial por plataforma+país, no por usuario). Esto se señala como discrepancia abajo y se resuelve con un default en "Decisiones tomadas".

### Comentarios del equipo

> The exact query is given verbatim in schema doc Section 8.1 — point the coding agent there directly. Cross-check `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2 (`/panel` or `/`) for exact card/header content (service+country header, counter copy example "23 títulos de tu lista disponibles ahora", poster grid with rating badge, skeleton loading state). "Marcar visto" action should follow the same `user_media_status` write pattern that RIK-9 (title detail) also uses — note this shared pattern as a constraint so both tickets converge on one server action rather than duplicating logic (e.g. a shared `actions/mediaStatus/markWatched.ts`).

Este comentario es autoritativo y define dos decisiones:

1. La lógica de la consulta del panel debe coincidir con la Sección 8.1 exactamente en sus joins/filtros/orden (la proyección de columnas sí puede acotarse — ver abajo).
2. La escritura de "marcar visto" debe construirse como una sola acción de servidor reutilizable, no duplicada cuando se implemente RIK-9 más adelante. La ruta sugerida por el comentario, `actions/mediaStatus/markWatched.ts`, usa camelCase; la convención real del proyecto (confirmada en la tabla de Server Actions de `ARCHITECTURE.md`) es kebab-case `actions/media-status/`. La acción compartida se ubica en `actions/media-status/markWatched.ts` para seguir esa convención existente en vez de la ruta literal del comentario.

Sección 8.1, copiada verbatim de `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`:

```sql
select distinct mi.*
from public.media_items mi
join public.user_media_status ums
     on ums.media_id = mi.id
    and ums.user_id = auth.uid()
    and ums.want_to_watch
    and not ums.watched
    and not ums.dismissed
join public.media_availability ma
     on ma.media_id = mi.id
    and ma.is_available
join public.user_subscriptions us
     on us.platform_id = ma.platform_id
    and us.country     = ma.country
    and us.user_id     = auth.uid()
    and us.ended_on is null
order by mi.imdb_rating desc nulls last;
```

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| Ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| "Encabezado con servicio/país activo" (servicio activo en singular) | `user_subscriptions_active_uq` es un índice único parcial sobre `(user_id, platform_id, country) where ended_on is null` — un usuario puede tener **múltiples** suscripciones activas simultáneas en distintos pares plataforma/país (confirmado por el propio criterio de RIK-6: "Es posible tener más de una suscripción activa simultánea si son plataforma/país distintos"). | El encabezado y la consulta deben soportar N ≥ 0 suscripciones activas, no exactamente una. Resuelto como default abajo (un badge por suscripción activa). |
| Ruta sugerida por el comentario para la acción compartida: `actions/mediaStatus/markWatched.ts` | La tabla de Server Actions de `ARCHITECTURE.md` usa nombres de carpeta en kebab-case (`media-status`, `imdb-import`, etc.), no camelCase. | La acción compartida se ubica en `actions/media-status/markWatched.ts` para respetar la convención existente del proyecto en vez de la grafía literal del comentario. |
| Contenido de la "cuadrícula de resultados", cruzado contra ambos documentos PRD | `RIKUNA-PRD-documento-especificacion-rikuna.md` §7.2 lista los campos de tarjeta como poster, título, año, calificación IMDb, **géneros**. `RIKUNA-PRD-vistas-y-estilo-rikuna.md` §2.2 (el documento dedicado de UI/estilo, más detallado) lista poster, título, año, `Badge` con calificación IMDb — sin géneros. La consulta 8.1 tampoco hace join con `genres`/`media_genres`. | Agregar géneros implicaría un join extra por tarjeta (o una segunda consulta), en contra del requisito de "sentirse instantáneo". Default: seguir §2.2 y la consulta 8.1 literal — sin badges de género en la cuadrícula del panel para este ticket. Registrado como decisión abajo. |
| No se menciona paginación/límite para el requisito de "carga instantánea con miles de títulos" | La consulta de la Sección 8.1 no tiene `LIMIT`, a diferencia de la consulta de descubrimiento de la Sección 8.2, que limita a 50. Se espera que el conjunto de la *intersección* (watchlist ∩ disponible ∩ no visto) siga siendo pequeño en la práctica aunque el historial personal sea grande, porque está acotado por el tamaño de la watchlist, no del catálogo. | Default: sin límite forzado para el MVP; confiar en los índices compuestos ya existentes (ver notas de verdad de base de datos) y verificar con datos sembrados de volumen realista según AC-5. Si la verificación demuestra que la consulta sin límite es lenta, agregar paginación como una desviación documentada, no como un cambio de alcance silencioso. |

### Estado actual en la base de datos

Aún no existe el directorio `supabase/migrations/` en este repositorio — RIK-1 no ha aterrizado al momento de escribir este documento. Este ticket se redacta **asumiendo que RIK-1 (esquema/RLS), RIK-2 (auth/rutas), RIK-3 (ingesta de catálogo), RIK-4 (importación IMDb) y RIK-6 (suscripciones) ya fueron implementados** (según sus propios specs de backlog) para cuando un agente de código tome este ticket. Las tablas y columnas de abajo se toman verbatim de `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (la fuente de verdad de RIK-1) — el agente de código debe re-verificarlas contra los archivos de migración reales en `supabase/migrations/` antes de escribir cualquier consulta, ya que el documento de esquema podría haberse desviado de lo que RIK-1 realmente entregó.

Columnas relevantes (todas preexistentes, este ticket no requiere ninguna columna nueva):

- `public.media_items`: `id uuid`, `imdb_id varchar unique`, `type varchar`, `title varchar`, `slug varchar unique`, `year integer`, `poster_url text`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `is_stub boolean default false`. Índice `media_items_rating_idx on (imdb_rating desc nulls last)` — coincide exactamente con el orden requerido.
- `public.user_media_status`: `id uuid`, `user_id uuid`, `media_id uuid`, `watched boolean default false`, `watched_at timestamptz`, `personal_rating smallint`, `want_to_watch boolean default false`, `dismissed boolean default false`, `source varchar default 'manual'`, `manually_edited boolean default false`. Constraint único `(user_id, media_id)`. Índice `ums_user_want_idx on (user_id, want_to_watch) where want_to_watch`.
- `public.media_availability`: `id uuid`, `media_id uuid`, `platform_id uuid`, `country varchar(2)`, `is_available boolean default true`, `last_seen_at timestamptz`, `last_snapshot_id uuid`. Único `(media_id, platform_id, country, offer_type)`. Índice `media_availability_lookup_idx on (platform_id, country, is_available)`.
- `public.user_subscriptions`: `id uuid`, `user_id uuid`, `platform_id uuid`, `country varchar(2)`, `started_on date`, `ended_on date` (nulo = activa). Índice único parcial `user_subscriptions_active_uq on (user_id, platform_id, country) where ended_on is null`. Índice `user_subscriptions_active_idx on (user_id) where ended_on is null`.
- `public.platforms`: `id uuid`, `name varchar`, `slug varchar unique`.

RLS (según doc de esquema §9): `media_items`/`media_availability`/`platforms` son de lectura pública; `user_media_status`/`user_subscriptions` son solo del dueño vía `auth.uid() = user_id`. Tanto `actions/recommendations/*` como `actions/media-status/*` deben correr bajo la sesión propia del usuario (cliente con alcance RLS de `lib/supabase/server.ts`), nunca `lib/supabase/admin.ts`.

**Uso actual en código:** ninguno — `services/`, `actions/`, `features/`, `components/` (más allá de `components/ui/button.tsx`) no existen aún en el repositorio (confirmado por listado de directorio al momento de escribir este spec). `ARCHITECTURE.md` describe su forma objetivo pero nada ha sido creado salvo la base de Next.js/shadcn y `components/ui/button.tsx`.

### Lógica actual (panel / recomendaciones)

No existe todavía una ruta `/panel` con contenido real. `app/page.tsx` sigue siendo el placeholder sin modificar de Create Next App. Según la verdad de base de este ticket, se espera que RIK-2 (auth/rutas, un ticket aparte) cree `app/(app)/panel/page.tsx` como un placeholder simple, únicamente para probar que el guard de autenticación redirige correctamente — este ticket **reemplaza el contenido de ese placeholder**; no crea la ruta desde cero.

La tabla de Server Actions de `ARCHITECTURE.md` ya reserva `actions/recommendations` para "'Qué ver este mes' and discovery queries (Sections 8.1–8.2 of the schema doc)" y `actions/media-status` para "Mark watched / want-to-watch / dismissed (`user_media_status` writes)" — ambas carpetas están nombradas pero no implementadas todavía. La lista de `services/index.ts` en `ARCHITECTURE.md` **no** incluye un servicio dedicado de recomendaciones; ver "Decisiones tomadas" para cómo este ticket resuelve ese vacío.

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Poster | `media_items.poster_url text` | Existe | Reusar |
| Título | `media_items.title varchar` | Existe | Reusar |
| Año | `media_items.year integer` | Existe | Reusar |
| Badge de calificación IMDb | `media_items.imdb_rating numeric(3,1)` | Existe | Reusar |
| Manejo de título "stub" | `media_items.is_stub boolean` | Existe | Reusar — `MediaCard` debe renderizar un poster placeholder de forma elegante cuando `is_stub = true`, según las convenciones de `ARCHITECTURE.md` |
| Encabezado servicio/país activo | `user_subscriptions.platform_id` → `platforms.name`, `user_subscriptions.country`, filtrado por `ended_on is null` | Existe | Reusar — un badge por fila activa, ver Decisiones |
| Contador de coincidencias | No es un campo de BD — se deriva del largo de la cuadrícula | N/A | Calcular en cliente a partir de la lista renderizada, sincronizado en cada remoción optimista |
| Escritura de "marcar visto" | `user_media_status.watched`, `watched_at`, `manually_edited`, `source` | Existe | Reusar vía acción compartida `markWatched` — sin columna nueva |

Este ticket no requiere ninguna migración.

### Archivos impactados

- **services**: `services/RecommendationServices.ts` (nuevo) — `getMonthlyWatchlist(supabase, userId)` implementando la lógica de joins/filtros/orden de la Sección 8.1 con una proyección de columnas explícita y acotada (ver Decisiones). `services/SubscriptionServices.ts` (existente, de RIK-6) — agregar/reusar un método que devuelva todas las suscripciones activas con el nombre de la plataforma y el país. `services/MediaStatusServices.ts` (existente, de RIK-4) — agregar/reusar un método `markWatched(supabase, userId, mediaId)`. `services/index.ts` — exportar `RecommendationServices`.
- **actions**: `actions/recommendations/getMonthlyWatchlist.ts` (nuevo) — verificación de sesión, llama a `RecommendationServices`. `actions/media-status/markWatched.ts` (nuevo, compartido con el futuro RIK-9) — verificación de sesión, llama a `MediaStatusServices.markWatched`, `revalidatePath('/panel')` (y `/biblioteca` según el patrón declarado en `ARCHITECTURE.md`). Archivos `index.ts` de barrel para ambas carpetas.
- **components**: `components/MediaCard/` (nuevo, compartido según `ARCHITECTURE.md` — "the single most reused component across panel, recommendations, biblioteca, lists, and public list view") — poster con espacio reservado vía `AspectRatio`, título, año, `Badge` de calificación, botón de acción en línea para marcar visto. Adiciones de shadcn necesarias según `components.json` (`style: base-lyra`, `baseColor: mist`): `Skeleton`, `Badge`, `Card`, `AspectRatio` (hoy solo existe `button.tsx`).
- **features**: `features/panel/` (nuevo) — `PanelHeader.tsx` (badges de suscripción activa + contador), `PanelGrid.tsx` (componente cliente, remoción optimista al marcar visto), `EmptySubscriptionState.tsx`, un hook/store cliente pequeño que mantenga el arreglo actual de coincidencias para que el contador y la cuadrícula se mantengan sincronizados tras quitar una tarjeta.
- **app routes**: `app/(app)/panel/page.tsx` (reemplaza el placeholder de RIK-2) — Server Component que hace fetch vía las dos nuevas acciones, boundary de `Suspense` con fallback tipo skeleton para la sensación de carga instantánea, renderiza `EmptySubscriptionState` cuando hay cero suscripciones activas.
- **middleware**: ninguno — `/panel` ya está dentro de `(app)`, protegido por RIK-2.
- **tests**: no existen aún en el repositorio; no se introducen en este ticket (ver Fuera de alcance).

### Decisiones tomadas

1. **Múltiples suscripciones activas en el encabezado.** Renderizar un badge compacto por cada fila activa de `user_subscriptions` (nombre de plataforma + país), ordenadas por `started_on desc`. Cuando hay exactamente una, esto coincide con el ejemplo de badge único del spec de producto ("Apple TV+ · Bolivia"). *Default recomendado, no confirmado por una persona — registrado como no confirmado en el prompt.*
2. **No había un `RecommendationServices` dedicado en la tabla de servicios de `ARCHITECTURE.md`.** Se crea un nuevo `services/RecommendationServices.ts` en vez de agregar este join de tres tablas a `MediaAvailabilityServices` o `MediaStatusServices`, porque la Sección 8.1 (y más adelante 8.2 para RIK-8) es su propia familia de consultas multi-dominio, y darle un hogar dedicado evita sobrecargar a cualquiera de los servicios existentes con joins fuera de su propósito declarado en una línea. *Default recomendado.*
3. **Proyección de columnas acotada respecto a `mi.*`.** La consulta literal de la Sección 8.1 selecciona `mi.*`, que incluye `metadata jsonb` y `description text` — payload innecesario para una cuadrícula de posters y directamente en contra del requisito de "sentirse instantáneo". El servicio selecciona una lista explícita de columnas (`id, slug, title, year, poster_url, imdb_rating, imdb_votes, is_stub`) preservando exactamente los mismos joins, filtros y `order by imdb_rating desc nulls last`. *Default recomendado.*
4. **Sin badges de género en la cuadrícula del panel**, siguiendo `vistas-y-estilo-rikuna.md` §2.2 por sobre `documento-especificacion-rikuna.md` §7.2, y coincidiendo con la consulta 8.1 literal (sin join de géneros). *Default recomendado.*
5. **No se agrega `LIMIT` a la consulta del panel** para el MVP; se espera que la intersección sea pequeña sin importar el tamaño total del historial. Verificar contra datos de prueba de volumen sembrado según AC-5 antes de dar por cerrado. Si la consulta resulta lenta, documentar la desviación en vez de paginar silenciosamente. *Default recomendado.*
6. **La ruta de la acción compartida `markWatched` es `actions/media-status/markWatched.ts`** (kebab-case, según `ARCHITECTURE.md`), no la grafía literal del comentario `actions/mediaStatus/markWatched.ts`. *Confirmado cruzando con la convención de nombres de carpeta ya existente en `ARCHITECTURE.md` — no es una suposición.*
7. **`markWatched` establece `watched = true`, `watched_at = now()`, `manually_edited = true`, `source = 'manual'`**, sin tocar `want_to_watch`. Esto refleja exactamente el criterio de aceptación propio de RIK-9 para el mismo patrón de escritura, dado que la acción es explícitamente compartida entre ambos tickets. *Confirmado por la redacción del AC de RIK-9 en `specs/RIKUNA-BACKLOG-v1-rikuna.md`.*
8. **"Sin recargar la página completa" se implementa como remoción optimista del lado cliente sobre el estado local, además de la acción de servidor + `revalidatePath('/panel')`.** `revalidatePath` por sí solo dispara un refresco suave de RSC (no una recarga de navegador) pero aún mostraría un viaje de red antes de que la tarjeta desaparezca; la remoción optimista lo hace instantáneo, y luego reconcilia silenciosamente con la respuesta del servidor. *Default recomendado.*

### Fuera de alcance

- Bloque de descubrimiento de `/recomendaciones` (consulta de la Sección 8.2, filtro de género, "no me interesa") — RIK-8.
- Vista de detalle `/titulo/[slug]` — RIK-9. Solo se construye aquí la acción compartida `markWatched` para que RIK-9 la reutilice más adelante.
- Cambiar/activar suscripciones — el CRUD completo de `user_subscriptions` es RIK-6; este ticket solo lee filas activas y enlaza a `/suscripciones`.
- Suite de pruebas automatizadas — no existe infraestructura de tests aún en este repositorio; no se introduce aquí.
- Paginación/scroll infinito para la cuadrícula del panel — se difiere salvo que la verificación de volumen de AC-5 demuestre que es necesaria; en ese caso, marcarlo como un ticket de seguimiento en vez de ampliar el alcance de este.

---

## Plan de implementación

**Objetivo:** Construir la pantalla real `/panel` contra el esquema real de RIK-1 y la consulta literal de la Sección 8.1, reemplazando el placeholder de RIK-2, con una ruta de escritura `markWatched` compartida que RIK-9 también consumirá.

**En alcance:**

1. `services/RecommendationServices.ts` — `getMonthlyWatchlist(supabase, userId)` implementando los joins/filtros/orden de la Sección 8.1 con una proyección de columnas acotada; exportado desde `services/index.ts`.
2. Extender `services/SubscriptionServices.ts` con un método para obtener todas las suscripciones activas actuales unidas a `platforms.name`.
3. Extender `services/MediaStatusServices.ts` con `markWatched(supabase, userId, mediaId)`.
4. `actions/recommendations/getMonthlyWatchlist.ts` — verificación de sesión + llamada al servicio.
5. `actions/media-status/markWatched.ts` — verificación de sesión + llamada al servicio + `revalidatePath('/panel')` y `/biblioteca`. Módulo compartido para RIK-9.
6. `components/MediaCard/` — poster (reservado con `AspectRatio`), título, año, `Badge` de calificación, acción en línea de marcar visto; manejo elegante de `is_stub`. Agregar los primitivos de shadcn faltantes (`Skeleton`, `Badge`, `Card`, `AspectRatio`) vía CLI, respetando `style: base-lyra` / `baseColor: mist` y la regla de radio de borde cero de Lyra.
7. `features/panel/` — `PanelHeader` (badges de suscripción activa + contador), `PanelGrid` (remoción optimista), `EmptySubscriptionState`.
8. `app/(app)/panel/page.tsx` — reemplaza el placeholder; Server Component que hace fetch de ambas acciones en paralelo, `Suspense` + fallback skeleton, renderiza estado vacío cuando hay cero suscripciones activas.
9. Sembrar datos de prueba de volumen realista localmente (varios miles de filas de `user_media_status`/`media_availability`) y verificar la latencia de la consulta / uso de índices antes de dar por cumplido AC-5.

**Fuera de alcance:** `/recomendaciones` (RIK-8), `/titulo/[slug]` (RIK-9), CRUD de suscripciones (RIK-6), tests automatizados (sin infraestructura aún), paginación (solo si la verificación de volumen demuestra que es necesaria).

**Riesgos clave / compatibilidad:**

- Este ticket asume que RIK-1/2/3/4/6 ya aterrizaron. Si `supabase/migrations/`, `types/`, `services/`, `actions/`, `features/` todavía no existen al comenzar el trabajo, detenerse y reportar la dependencia bloqueada en vez de inventar el esquema o el alcance de esos tickets.
- `user_subscriptions` permite múltiples filas activas simultáneas — no asumir exactamente una ni en la consulta ni en la UI del encabezado.
- Mantener `actions/recommendations` y `actions/media-status` en el cliente con alcance RLS (`lib/supabase/server.ts`); nunca importar `lib/supabase/admin.ts` aquí.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | `RecommendationServices.getMonthlyWatchlist` reproduciendo exactamente los filtros de la Sección 8.1 |
| AC-2 | Contador derivado del mismo arreglo renderizado como tarjetas, actualizado en cada remoción optimista |
| AC-3 | Acción `markWatched` + remoción optimista del lado cliente, sin `window.location`/recarga completa |
| AC-4 | `EmptySubscriptionState` renderizado cuando la consulta de suscripciones activas devuelve cero filas |
| AC-5 | Proyección acotada, índices compuestos existentes, verificado contra datos de volumen sembrados |
| AC-6 | Módulo compartido `actions/media-status/markWatched.ts`, no duplicado por pantalla |

---

## Prompt para Claude Code

```xml
<task id="RIK-7" title="Panel principal (Qué ver este mes)" depends_on="RIK-1,RIK-2,RIK-3,RIK-4,RIK-6">
  <role>
    You are a senior full-stack engineer working on Rikuna, a personal streaming-rotation planner built with
    Next.js 16 (App Router) and React 19 on top of Supabase (Postgres + Auth + RLS). You follow the project's
    layered + feature-sliced architecture strictly: app/ (thin routes) -> actions/ (server actions) ->
    services/ (Supabase query/DTO layer) -> features/ (client screens) -> components/ (shared UI).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, auth route groups, actions/services conventions, ingestion vs user-facing boundaries.</item>
    <item>AGENTS.md — this Next.js install has breaking changes vs. your training data. Before writing any App Router, Server Action, caching, or Suspense/streaming code, read the relevant guide under node_modules/next/dist/docs/ (resolved from AGENTS.md's directory) and heed deprecation notices.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping used by this task's completion_report.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 8.1 (the exact query this ticket implements), Section 3.3 (availability upsert/expire logic, for context only — not modified here), Section 4 (user_subscriptions), Section 5 (user_media_status), Section 9 (RLS).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 2.2 ("/ o /panel") for exact header/counter/grid/skeleton content, and Section 3 for the Lyra style rules (zero border-radius, AspectRatio-reserved posters).</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — Section 7.2 (panel purpose) and Section 11 ("debe sentirse instantáneo aun con miles de títulos") for the performance requirement's product rationale.</item>
    <item>components.json — confirm style: base-lyra, baseColor: mist before adding any shadcn component.</item>
    <item>The most recent migration file(s) in supabase/migrations/ (created by RIK-1) — verify the real column names/types/defaults for media_items, media_availability, user_subscriptions, user_media_status, platforms match this task's ground_truth_db_notes before writing any query. If supabase/migrations/ does not exist yet, STOP and report RIK-1 as an unmet dependency — do not invent the schema.</item>
    <item>types/index.ts, services/index.ts, actions/ (existing barrels from RIK-1/2/3/4/6) — reuse existing types and service methods where they already cover this ticket's needs (e.g. UserSubscription, MediaItem, an existing MediaStatusServices class) instead of recreating them.</item>
    <item>CHANGELOG.md — format and where to append entries.</item>
    <item>specs/logs/README.md — work log filename and template.</item>
  </mandatory_reading>

  <context>
    Rikuna's landing screen after login is /panel: the intersection of what the user wants to watch, what is
    currently available on a streaming service they subscribe to, and what they have not watched yet. This is
    the product's core value proposition. RIK-2 will have already created app/(app)/panel/page.tsx as a bare
    placeholder solely to prove the auth guard redirects unauthenticated visitors correctly — this task
    replaces that placeholder's content with the real screen, it does not create the route from nothing.

    None of services/, actions/, features/, components/ (beyond components/ui/button.tsx) existed when this
    spec was authored. This task assumes RIK-1 (schema/RLS), RIK-2 (auth/routing), RIK-3 (catalog ingestion),
    RIK-4 (IMDb import), and RIK-6 (subscriptions) have already landed their own services/actions/types. Reuse
    what they already built; do not re-implement their scope.
  </context>

  <ground_truth_db_notes critical="true">
    <note>The exact query this ticket implements lives verbatim in specs/RIKUNA-PRD-schema-basedatos-rikuna.md Section 8.1. Preserve its joins, filters, and `order by imdb_rating desc nulls last` exactly. You MAY narrow the column projection away from the literal `mi.*` (see below) but must not change which rows match.</note>
    <note>media_items real columns used here: id, imdb_id, type, title, slug, year, poster_url, imdb_rating (numeric(3,1), nullable), imdb_votes, is_stub (boolean, default false). There is a real index media_items_rating_idx on (imdb_rating desc nulls last) — your query's ORDER BY should be able to use it.</note>
    <note>user_media_status real columns: user_id, media_id, watched, watched_at, want_to_watch, dismissed, source ('manual' | 'imdb_ratings' | 'imdb_watchlist'), manually_edited. Unique constraint on (user_id, media_id) — a want_to_watch=true row is guaranteed to already exist for anything visible in the panel, so markWatched must be an UPDATE, not a blind upsert. Index ums_user_want_idx on (user_id, want_to_watch) where want_to_watch exists to accelerate this ticket's query.</note>
    <note>media_availability real columns: media_id, platform_id, country, is_available, last_seen_at, last_snapshot_id. Unique (media_id, platform_id, country, offer_type). Index media_availability_lookup_idx on (platform_id, country, is_available) exists to accelerate this ticket's query.</note>
    <note>user_subscriptions: a user CAN have MULTIPLE simultaneously active rows for different platform_id/country pairs. "Active" means ended_on is null — there is no boolean/status column. The partial unique index user_subscriptions_active_uq is scoped to (user_id, platform_id, country), not to the user alone. Do NOT assume exactly one active subscription in either the query or the header UI; render one badge per active row.</note>
    <note>There is no country column on media_items. Country is only a property of media_availability and user_subscriptions rows.</note>
    <note>RLS: media_items/media_availability/platforms are publicly readable. user_media_status/user_subscriptions are owner-only via auth.uid() = user_id. Use the RLS-scoped server client from lib/supabase/server.ts in both new actions folders — never lib/supabase/admin.ts, which is reserved for ingestion/ only.</note>
    <note>No new migration is required by this ticket. If any column referenced above is missing when you inspect the actual migration files, STOP and report the discrepancy instead of adding a migration yourself outside RIK-1's scope.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="Services">
      <item>Create services/RecommendationServices.ts exporting a class/object with getMonthlyWatchlist(supabase: SupabaseClient, userId: string) implementing Section 8.1's join/filter/order logic. Select an explicit column list (id, slug, title, year, poster_url, imdb_rating, imdb_votes, is_stub) instead of the literal `mi.*` — do not select description or metadata, they are unused by the grid and unnecessarily inflate the response. Export it from services/index.ts.</item>
      <item>Extend the existing subscriptions service (from RIK-6) with a method returning all rows where ended_on is null for the current user, joined to platforms.name, ordered by started_on desc. Reuse the existing service/class name and file if RIK-6 already created one — do not create a duplicate service.</item>
      <item>Extend the existing media-status service (from RIK-4) with markWatched(supabase, userId, mediaId): update the existing user_media_status row (do not insert) setting watched = true, watched_at = now(), manually_edited = true, source = 'manual'. Do not touch want_to_watch. Reuse the existing service file/class if RIK-4 already created one.</item>
    </phase>

    <phase title="Actions">
      <item>Create actions/recommendations/getMonthlyWatchlist.ts ("use server"): verify the session via supabase.auth.getUser(), instantiate RecommendationServices with the session-bound client, call getMonthlyWatchlist, return the rows.</item>
      <item>Create actions/media-status/markWatched.ts ("use server"): this is a SHARED action — RIK-9 (title detail) will also call it later, do not scope it to the panel screen only. Verify the session, call the service's markWatched, then revalidatePath('/panel') and revalidatePath('/biblioteca'). Return a small result object the client can use to reconcile optimistic UI (success boolean, error message on failure).</item>
      <item>Add/confirm barrel index.ts files for both actions/recommendations/ and actions/media-status/.</item>
    </phase>

    <phase title="Components">
      <item>Add missing shadcn primitives via the project's configured registry (components.json: style base-lyra, baseColor mist): Skeleton, Badge, Card, AspectRatio. Confirm zero border-radius is applied per the Lyra style rule in vistas-y-estilo-rikuna.md Section 3 — override any default radius token if the generator does not already force it to 0.</item>
      <item>Create components/MediaCard/ as a shared component (it will be reused by RIK-8, biblioteca, lists, and the public list view later — keep its props generic, not panel-specific): poster with AspectRatio-reserved space (so the layout does not jump before the image loads), title, year, an IMDb rating Badge, and a slot for an inline "mark watched" action. When is_stub is true, render a poster placeholder and do not assume poster_url/description exist.</item>
    </phase>

    <phase title="Features">
      <item>Create features/panel/PanelHeader.tsx: renders one compact badge per active subscription (platform name + country), and the counter copy "{count} título(s) de tu lista disponible(s) ahora" (Spanish, matching the product spec's example "23 títulos de tu lista disponibles ahora" — handle singular/plural correctly).</item>
      <item>Create features/panel/PanelGrid.tsx as a client component: receives the initial getMonthlyWatchlist result as props, holds it in local state, renders a MediaCard per item. On mark-watched: optimistically remove the card from local state immediately (so it disappears without waiting on the network), call the markWatched action, and on failure re-insert the card and show an error via Sonner (the project's toast library). The counter in PanelHeader must reflect this same local state, not a separate count.</item>
      <item>Create features/panel/EmptySubscriptionState.tsx: Spanish copy explaining there is no active subscription, with a Button linking to /suscripciones ("Configurar mi suscripción" per vistas-y-estilo-rikuna.md's own copy for this exact state).</item>
    </phase>

    <phase title="Routes">
      <item>Replace the placeholder content of app/(app)/panel/page.tsx (created by RIK-2) with a Server Component: fetch active subscriptions and, only if at least one exists, fetch getMonthlyWatchlist (both via the new actions), in parallel where possible. Wrap the grid fetch in a Suspense boundary with a Skeleton grid fallback matching vistas-y-estilo-rikuna.md's stated skeleton loading state. Render EmptySubscriptionState when there are zero active subscriptions instead of running the watchlist query at all.</item>
    </phase>

    <phase title="Verification">
      <item>Seed realistic volume test data locally (several thousand user_media_status rows and a matching spread of media_availability rows) to verify AC-5. If no seed script exists yet in this repo, write a throwaway local script or SQL block for this verification only — do not commit a permanent seed script unless one is clearly expected elsewhere in the project; note this choice in the completion report.</item>
      <item>Confirm via EXPLAIN (or equivalent) that the query benefits from ums_user_want_idx and media_availability_lookup_idx, not a sequential scan, at that data volume.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">The grid renders only titles where want_to_watch = true, watched = false, dismissed = false, and available (is_available = true) on a platform+country matching one of the user's currently active subscriptions. Verify by seeding a mixed dataset (some watched, some dismissed, some unavailable, some on a platform the user does not subscribe to) and confirming only the true-positive rows render.</criterion>
    <criterion id="AC-2">The counter's number always equals the number of MediaCard elements currently rendered, including immediately after an optimistic removal (not just on initial load). Verify by counting rendered cards vs. the displayed counter value before and after a mark-watched click.</criterion>
    <criterion id="AC-3">Clicking "mark watched" on a card removes it from the grid without a full browser navigation/reload (no window.location usage, no full-page Server Component remount from scratch) — the card disappears immediately (optimistic) and the underlying user_media_status row is confirmed updated server-side (watched = true, manually_edited = true, source = 'manual').</criterion>
    <criterion id="AC-4">With zero rows in user_subscriptions where ended_on is null for the current user, the page renders EmptySubscriptionState with a working Button/link to /suscripciones, and does not attempt to run or render results from getMonthlyWatchlist.</criterion>
    <criterion id="AC-5">With several thousand seeded user_media_status/media_availability rows for a test user, the panel's initial data fetch is verified fast (confirm index usage per the Verification phase) and the Suspense/skeleton fallback is visibly used during the fetch rather than a blank screen.</criterion>
    <criterion id="AC-6">The mark-watched write logic exists in exactly one place, actions/media-status/markWatched.ts, callable by both this screen and (later) RIK-9's title detail screen — verify by inspection that no duplicate user_media_status write logic for "mark watched" exists elsewhere in the diff.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new Supabase migration for this ticket — all required tables/columns/indexes are RIK-1's scope. If something referenced in ground_truth_db_notes is missing from the real migrations, STOP and report it as a blocked dependency.</item>
    <item>Do NOT import lib/supabase/admin.ts from actions/recommendations/ or actions/media-status/ — both are user-facing, session-scoped flows and must rely on RLS via the regular server client.</item>
    <item>Do NOT rename or alter any column on media_items, user_media_status, media_availability, or user_subscriptions.</item>
    <item>Do NOT assume exactly one active subscription anywhere — the query and the header must both support zero, one, or many active user_subscriptions rows.</item>
    <item>Do NOT add a genre join/filter to the panel grid in this ticket (see Decisions in the backlog doc) — that belongs to a future ticket if ever needed.</item>
    <item>Do NOT implement /recomendaciones, /titulo/[slug], or subscription activation/editing in this ticket — those are RIK-8, RIK-9, and RIK-6 respectively.</item>
    <item>All user-visible copy must be Spanish; all code identifiers, comments, and commit/PR text must be English, per ARCHITECTURE.md.</item>
    <item>Respect the Lyra style rule: zero border-radius on all generated components; MediaCard posters must reserve space via AspectRatio before the image loads.</item>
  </constraints>

  <out_of_scope>
    <item>/recomendaciones discovery block (Section 8.2 query, genre filter, dismiss action) — RIK-8.</item>
    <item>/titulo/[slug] detail screen UI — RIK-9. Only the shared markWatched action is delivered here.</item>
    <item>Subscription activation, editing, or history UI — RIK-6 owns /suscripciones itself; this ticket only reads active rows and links out to it.</item>
    <item>Automated tests — no test infrastructure exists in this repository yet; do not introduce a test runner as a side effect of this ticket.</item>
    <item>Pagination/infinite scroll for the panel grid — only add if your AC-5 volume verification proves the unbounded query is too slow, and if so, document it explicitly as a deviation in the verification report rather than silently changing scope.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Suggested service signature: `getMonthlyWatchlist(supabase: SupabaseClient, userId: string): Promise&lt;MonthlyPick[]&gt;` where MonthlyPick is a narrow type (id, slug, title, year, posterUrl, imdbRating, imdbVotes, isStub) colocated with the service rather than added to the shared types/index.ts barrel, since it is a query-shaped projection, not a 1:1 table type.</item>
    <item>Suggested action signature: `markWatched(mediaId: string): Promise&lt;{ success: boolean; error?: string }&gt;`.</item>
    <item>Mobile-first layout: per documento-especificacion-rikuna.md Section 11, the "what do I watch now" decision is typically made in front of the TV with a phone in hand — the grid must be usable at small viewport widths, not just desktop.</item>
  </implementation_notes>

  <clarify_before_coding>
    <item>Header treatment for multiple simultaneously active subscriptions was not specified by the ticket. Default: one compact badge per active subscription, sorted by started_on desc. Proceed with this default; do not block on it.</item>
    <item>Whether the panel grid needs pagination at very large scale was not specified. Default: no limit for MVP, verify with seeded volume data; only add pagination if verification proves it necessary, and document the deviation. Proceed with this default; do not block on it.</item>
  </clarify_before_coding>

  <deliverables>
    <item>All files listed in the requirements phases above, working end to end.</item>
    <item>Run npm run lint and fix any issues introduced by this change. There is no test suite yet, so no test command to run.</item>
    <item>Persist documentation per completion_report/persistence below.</item>
  </deliverables>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-6): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-7: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-7_monthly_watch_panel.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Link to specs/backlog/RIK-7_monthly_watch_panel.md in the metadata table.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: services / actions / components / features / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-7 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; an optional "Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the main dashboard" instead of naming the route, "the subscription badge" instead of naming a component, "the watchlist matching logic" instead of naming a query.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Include a "## Screenshots" section (this ticket has user-visible UI): list 1–4 items, each with screen/area name, auth state, and what it should show — e.g. "Panel — with an active subscription: header badge, counter text, poster grid with rating badges", "Panel — no active subscription: empty state with the button to subscriptions", "Panel — after marking a title watched: card removed, counter updated". Prefix each with `[attach: short label]` since the human attaches the actual image.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. Include "## Prerequisites" (dev server running, a logged-in test user, an active subscription for the positive-path steps, seeded watchlist/availability data), then "## UI validation" with numbered steps covering: viewing /panel with an active subscription and matching titles, marking one watched and confirming it disappears with the counter updating without a page reload, and viewing /panel with zero active subscriptions to confirm the empty state and its link to /suscripciones. Also include "## Database validation" with a read-only SQL query against user_media_status confirming a marked title now has watched = true, manually_edited = true, source = 'manual'. End with "## Expected outcome" (1–3 bullets tying back to the acceptance criteria).</item>
      <item>Use concrete app paths: /panel, /suscripciones.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```

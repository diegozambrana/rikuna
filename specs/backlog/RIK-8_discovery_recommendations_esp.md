# RIK-8 — Recomendaciones por descubrimiento

> Documento de lectura en español. El archivo fuente de verdad es `specs/backlog/RIK-8_discovery_recommendations.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

Implementa la vista `/recomendaciones`: una página con dos bloques apilados — (a) el subconjunto de la watchlist del usuario que está disponible ahora mismo en su suscripción activa (el mismo cruce que usa el panel), y (b) "Descubre algo nuevo", una lista calculada en vivo con títulos bien calificados, disponibles y no vistos que **no** están en la watchlist, filtrable por género. Las tarjetas del bloque de descubrimiento ofrecen "Agregar a watchlist" y "No me interesa" (`dismissed = true`).

- El bloque de descubrimiento nunca debe volver a mostrar títulos que ya están en la watchlist, ya vistos, o ya descartados.
- El bloque de descubrimiento respeta el umbral mínimo de calificación/votos de la consulta 8.2 del esquema (`imdb_rating >= 7.0`, `imdb_votes >= 5000`) para que no se cuelen "joyas" con pocos votos.
- Un filtro de género (`Select`) reduce **ambos** bloques a títulos que incluyen ese género — la consulta base 8.2 no tiene join de género, así que este ticket agrega uno.
- "No me interesa" persiste `dismissed = true` y el título permanece fuera tras recargar.
- "Agregar a watchlist" desde una tarjeta de descubrimiento debe hacer que ese título aparezca en el bloque (a) en la siguiente carga de página.
- No existen comentarios del equipo más allá del texto del ticket; el análisis abajo agrega detalle requerido (extracción de constantes, reuso de la acción compartida de escritura, extensión del join de género) que el ticket implica pero no detalla.

---

## Contexto

### Ticket original

**RIK-8 — Recomendaciones por descubrimiento**

**Descripción:** Vista `/recomendaciones` con dos bloques: (a) subconjunto de la watchlist disponible ahora (reuso de la consulta del panel), y (b) descubrimiento — títulos bien calificados, disponibles, no vistos y fuera de la watchlist (consulta 8.2 del esquema), con filtro por género y acción de descartar (`dismissed`).

**Criterios de aceptación:**

- El bloque "Descubre algo nuevo" nunca incluye títulos ya en la watchlist, ya vistos, o descartados.
- El bloque respeta el umbral mínimo de calificación y de votos definido en la consulta 8.2 (evita títulos con pocos votos).
- El filtro de género reduce ambos bloques a títulos que incluyen ese género.
- "No me interesa" marca `dismissed = true` y el título no vuelve a aparecer en recomendaciones (verificar recarga).
- "Agregar a watchlist" desde una tarjeta de descubrimiento la mueve al primer bloque en la siguiente carga.

**Dependencias (según el backlog v1):** `depends_on RIK-1, RIK-2, RIK-3, RIK-6`.

El ticket apunta a una tabla/consulta (`media_items` filtrada por `imdb_rating`/`imdb_votes`) que todavía no existe en este repositorio — `supabase/migrations/` no está creado. Esto es lo esperado: se asume que RIK-1 (esquema), RIK-2 (auth/rutas), RIK-3 (ingesta de disponibilidad) y RIK-6 (suscripción activa) se implementan primero, según el encargo de esta tarea. Este documento especifica el ticket contra el esquema que esos tickets producirán, no contra el repositorio vacío actual.

### Comentarios del equipo

No se proporcionaron comentarios para este ticket más allá de la descripción y los criterios de aceptación anteriores — no hay un "comentario autoritativo" separado que reemplace la descripción. El análisis abajo saca a la luz alcance implícito que la descripción no detalla textualmente (join de género, extracción de constantes, acción de escritura compartida) y lo trata como extensiones requeridas, no como comentarios.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| Ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| "(a) subconjunto de la watchlist disponible ahora (reuso de la consulta del panel)" | El backlog hermano indica que `RIK-7` (panel) depende de `RIK-1, RIK-2, RIK-3, RIK-4, RIK-6`, y `RIK-8` depende de `RIK-1, RIK-2, RIK-3, RIK-6` — **`RIK-8` no depende de `RIK-7`**, y ambos están siendo especificados/implementados por procesos paralelos sin orden garantizado. "Reusar la consulta del panel" no puede significar "importar desde `features/panel`" — significa que ambos tickets deben compartir una sola implementación de la consulta 8.1 en la capa `services/`/`actions/recommendations`, dondequiera que aterrice primero. |
| "consulta 8.2 del esquema" ... "con filtro por género" | La consulta textual en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 8.2 (líneas 385–404) **no tiene filtro ni join de género en absoluto**. Los géneros viven en una tabla de unión muchos-a-muchos separada (`media_genres` → `genres`, Sección 2.2, líneas 72–104). | El filtro de género es una extensión propia de este ticket sobre la consulta base, no algo para copiar textualmente. Hay que agregar un join a través de `media_genres`/`genres` y un `WHERE genres.slug = :genre` (o filtro PostgREST equivalente) a **ambos** bloques, preservando `select distinct` para que los títulos con varios géneros no se dupliquen. |
| El ticket no menciona dónde viven los umbrales `7.0` / `5000` | `ARCHITECTURE.md` (línea 206) nombra explícitamente `constants/recommendationThresholds.ts` — `minRating`, `minImdbVotes`, `minVotesFloor` — como el lugar al que pertenecen los umbrales de recomendación, y ese archivo/directorio aún no existe (proyecto recién generado; `constants/` es uno de los directorios confirmados ausentes). | Este ticket debe crear `constants/recommendationThresholds.ts` y leer los umbrales desde ahí en la consulta de descubrimiento, en lugar de dejar `7.0`/`5000` como números mágicos dentro de un servicio — requerido por el propio documento de arquitectura del proyecto aunque el texto del ticket no lo pida explícitamente. |
| Nota bajo el ticket: "'Agregar a watchlist' ... debería reusar el patrón de server action compartido de `user_media_status` (también usado por RIK-7 y RIK-9)" | `actions/media-status/` todavía no existe. Nada en el código define hoy ese "patrón compartido". | Este ticket es el que debe crear la primera versión de `actions/media-status/` (agregar a watchlist, descartar), estructurada para que RIK-7 (marcar visto desde la tarjeta del panel) y RIK-9 (acciones de la ficha de título) puedan extenderla después — o extenderla si un ticket paralelo ya la creó primero. |
| El ticket no dice nada sobre la mecánica del layout (`Tabs` vs. bloques apilados) | `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Sección 2.2 (`/recomendaciones`, líneas 108–114) permite explícitamente cualquiera de las dos: "dos secciones con `Tabs` o simplemente dos bloques apilados con títulos claros." | Decisión no bloqueante; se registra como default abajo (bloques apilados, coherente con el texto del criterio de aceptación "el primer bloque"). |

### Estado actual en la base de datos

No existe `supabase/migrations/` en este repositorio todavía. El esquema abajo se copia de `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (v3) y se corrobora con `specs/backlog/RIK-1_database_schema_rls.md`, ya escrito, que confirma que el DDL se toma textualmente de ese documento PRD sin renombres relevantes para este ticket. Tratar lo siguiente como verdad una vez que RIK-1 aterrice:

- **`media_items`** (Sección 2.1, líneas 24–68) — columnas relevantes: `id uuid`, `title varchar`, `slug varchar unique`, `type varchar`, `year integer`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `poster_url text`, `is_stub boolean`. RLS: lectura pública (Sección 9), escritura restringida a admin/ingesta.
- **`genres`** / **`media_genres`** (Sección 2.2, líneas 72–86) — `genres(id, name, slug unique)`; `media_genres(media_id, genre_id)` tabla de unión con PK compuesta, índice en `genre_id`. RLS: lectura pública, igual que el grupo catálogo padre según la Decisión 3 de `RIK-1_database_schema_rls.md`.
- **`media_availability`** (Sección 3.3) — `media_id`, `platform_id`, `country varchar(2)`, `is_available boolean`. RLS: lectura pública.
- **`user_subscriptions`** (Sección 4, líneas 190–215) — `user_id`, `platform_id`, `country`, `ended_on date` (`null` = activa). Un índice único parcial garantiza como máximo una fila activa por `(user_id, platform_id, country)`. RLS: solo el dueño.
- **`user_media_status`** (Sección 5, líneas 224–253) — `user_id`, `media_id`, `watched boolean`, `want_to_watch boolean`, `dismissed boolean`, `source varchar` (`'manual' | 'imdb_ratings' | 'imdb_watchlist'`), `manually_edited boolean`, único en `(user_id, media_id)`. RLS: solo el dueño. Regla de negocio (línea 257): `watched` y `want_to_watch` son independientes; si ambos son verdaderos, `watched` gana y el título **no** debe aparecer en "Qué ver este mes" (esta regla se traslada al filtro de descubrimiento de la consulta 8.2 mediante el mismo guard `coalesce(ums.watched, false) = false`).

No existen los directorios `types/`, `services/`, `actions/`, `features/`, `constants/` en este repositorio al momento de este documento. Se espera que existan cuando este ticket se ejecute (RIK-1/RIK-2 crean las capas base según `ARCHITECTURE.md`); si aún no existen, quien implemente este ticket debe crearlos siguiendo el patrón de una carpeta hermana documentado ahí.

### Lógica actual (recomendaciones)

No existe lógica de recomendaciones en el código — esto es terreno nuevo. Las dos consultas que este ticket implementa, textuales de `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`:

**Bloque (a) — consulta 8.1, "Qué ver este mes" (líneas 361–381):**

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

**Bloque (b) — consulta 8.2, "Recomendaciones por descubrimiento" (líneas 385–404), versión base sin filtro de género:**

```sql
select distinct mi.*
from public.media_items mi
join public.media_availability ma
     on ma.media_id = mi.id and ma.is_available
join public.user_subscriptions us
     on us.platform_id = ma.platform_id
    and us.country     = ma.country
    and us.user_id     = auth.uid()
    and us.ended_on is null
left join public.user_media_status ums
     on ums.media_id = mi.id and ums.user_id = auth.uid()
where coalesce(ums.watched,       false) = false
  and coalesce(ums.want_to_watch, false) = false
  and coalesce(ums.dismissed,     false) = false
  and mi.imdb_rating >= 7.0
  and mi.imdb_votes  >= 5000        -- evita "joyas" falsas con muy pocos votos
order by mi.imdb_rating desc
limit 50;
```

El documento de especificación de producto confirma (`RIKUNA-PRD-documento-especificacion-rikuna.md`, línea 176) que estas listas deben calcularse **en vivo** en cada request, no precalcularse por el proceso externo de catálogo — marcar un título como visto o descartado debe afectar inmediatamente lo que devuelve el bloque (b), así que esto es lógica de consulta de la capa de aplicación, no una lista materializada/cacheada.

### Mapeo de campos solicitados

Este ticket no solicita columnas nuevas — es un ticket de consulta de lectura + acción de escritura + UI. La tabla abajo mapea las columnas de las que dependen las consultas a su estado.

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Umbral de calificación (`imdb_rating >= 7.0`) | comparación numeric(3,1) | `media_items.imdb_rating` (Sección 2.1) | ya existe (reusar) — debe venir de `constants/recommendationThresholds.ts`, no hardcodeado |
| Umbral de votos (`imdb_votes >= 5000`) | comparación integer | `media_items.imdb_votes` (Sección 2.1) | ya existe (reusar) — mismo archivo de constantes |
| Filtro de género | join/filtro | `media_genres` / `genres.slug` (Sección 2.2) | ya existe (reusar) — debe agregarse como join explícito, ausente en la consulta base 8.2 |
| Flag "descartado" | boolean | `user_media_status.dismissed` (Sección 5) | ya existe (reusar) |
| Flag "agregar a watchlist" | boolean | `user_media_status.want_to_watch` (Sección 5) | ya existe (reusar) |
| Verificación de suscripción activa | join | `user_subscriptions.ended_on is null` (Sección 4) | ya existe (reusar) |

### Archivos impactados

- `constants/recommendationThresholds.ts` (nuevo) — extrae `7.0` / `5000` del SQL crudo según `ARCHITECTURE.md`.
- `services/RecommendationServices/index.ts` (nuevo, o extender si una ejecución paralela de RIK-7 ya lo creó) — centraliza las consultas 8.1 y 8.2 (con la extensión del join de género) y su mapeo a `MediaItem[]`.
- `actions/recommendations/index.ts` (nuevo, o extender) — verificación de sesión, llama a `RecommendationServices`, devuelve ambos bloques para la página.
- `actions/media-status/index.ts` (nuevo, o extender) — `addToWatchlist(mediaId)` y `dismissRecommendation(mediaId)` server actions que escriben en `user_media_status` con `manually_edited = true`, `source = 'manual'`; `revalidatePath('/recomendaciones')`. Estructurado para reuso de RIK-7/RIK-9 según la nota propia del ticket.
- `types/index.ts` (modificado, si aún no lo cubre) — confirmar que `MediaItem` y `Genre` estén exportados; agregar un tipo pequeño tipo `DiscoveryFilters` si conviene.
- `features/recommendations/` (nuevo) — `RecommendationsScreen.tsx` (compone ambos bloques), `GenreFilterSelect.tsx` (componente cliente que maneja el search param `?genero=`), `DiscoveryCard.tsx` (envuelve el `MediaCard` compartido con los dos botones de acción).
- `app/(app)/recomendaciones/page.tsx` (nuevo) — Server Component que lee `searchParams.genero`, llama a `actions/recommendations`, renderiza el feature screen. Vive dentro del route group `(app)` para que aplique el guard de auth existente — sin trabajo nuevo de middleware.
- `components/MediaCard/` — se reusa tal cual para ambos bloques; solo se agregan los dos botones de acción en el nivel de composición (`DiscoveryCard`), no dentro de la tarjeta compartida, salvo que ya soporte un slot/prop de acciones.
- Tests — no existe suite de pruebas todavía en este repositorio; se anota dónde debería vivir la cobertura de las consultas de descubrimiento cuando se agregue un framework (por ejemplo `services/RecommendationServices/*.test.ts`), sin bloquear este ticket por eso.

### Decisiones tomadas

1. **Las consultas 8.1 y 8.2 viven en un nuevo `services/RecommendationServices`**, aunque no está nombrado en la lista actual de servicios de `ARCHITECTURE.md` (esa lista refleja que nada se ha construido todavía, no un inventario futuro exhaustivo). Si una implementación paralela de `RIK-7` ya creó un servicio que expone la consulta 8.1, **reusarlo** en vez de duplicar — revisar `services/` antes de crear. Default recomendado, no confirmado por el usuario.
2. **El filtro de género se implementa como una extensión explícita** (`left join media_genres … left join genres … and (genre_slug is null or genres.slug = genre_slug)`) preservando `select distinct` en ambas consultas, ya que el SQL base 8.2 no tiene noción de género. Default recomendado.
3. **`constants/recommendationThresholds.ts` exporta `RECOMMENDATION_THRESHOLDS = { minRating: 7.0, minImdbVotes: 5000, minVotesFloor: 5000 }`**, respetando los tres nombres que `ARCHITECTURE.md` ya fija (`minRating`, `minImdbVotes`, `minVotesFloor`) aunque la consulta 8.2 solo use dos umbrales. `minVotesFloor` se fija igual a `minImdbVotes` por ahora, como piso defensivo reservado para un futuro `minImdbVotes` configurable por admin; no se usa en la lógica de este ticket. **Default recomendado, sin confirmar** — marcado en `<clarify_before_coding>`.
4. **El filtro de género se lleva en la URL como `?genero=<slug>`**, leído del lado servidor en `app/(app)/recomendaciones/page.tsx`, en lugar de un store Zustand del lado cliente — la única interacción cliente aquí es elegir un género y volver a pedir datos del servidor, algo que un simple round-trip de navegación/search-param cubre sin estado cliente extra. Default recomendado; se desvía del patrón general "Zustand para filtros" de `ARCHITECTURE.md` para este caso específico de baja complejidad.
5. **Las opciones del dropdown de género vienen de la tabla `genres` completa** (`select id, name, slug from genres order by name`), no acotadas a los géneros presentes en los títulos elegibles. Más simple, evita una consulta de agregación extra; un género aún no elegible simplemente devuelve un bloque vacío. Default recomendado.
6. **El layout usa dos bloques apilados**, no `Tabs` — ambos están permitidos por `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Sección 2.2; los bloques apilados encajan mejor con el propio texto del criterio de aceptación del ticket ("el primer bloque") que una UI de pestañas. Default recomendado.
7. **`actions/media-status/index.ts` se crea (o se extiende) en este ticket** con `addToWatchlist` y `dismissRecommendation`, ambos con verificación de sesión + `revalidatePath('/recomendaciones')` y, cuando aplique, `revalidatePath('/panel')`. Esto lo pide directamente la propia nota del ticket sobre el patrón de acción compartido, no es una decisión nueva — se registra aquí por trazabilidad.
8. **El `limit 50` de la consulta base en el bloque (b) se mantiene tal cual**; no se agrega paginación ni scroll infinito en este ticket. Default recomendado.

### Fuera de alcance

- Construir la pantalla `/panel` en sí (RIK-7) — este ticket solo necesita el resultado de la consulta 8.1 para el bloque (a); la UI completa del panel (encabezado de servicio activo, CTA de estado vacío) es responsabilidad de RIK-7.
- El destino completo de navegación a la ficha de título (`/titulo/[slug]`) — RIK-9. Las tarjetas aquí solo necesitan enlazar ahí, no implementar el destino.
- "Marcar visto" desde una tarjeta de recomendación — no está en los criterios de aceptación de este ticket; el módulo compartido `actions/media-status` debe estructurarse para que RIK-9 pueda agregarlo después sin reestructurar.
- Paginación/scroll infinito más allá del `limit 50` en la consulta 8.2.
- Distinciones de `offer_type` (alquiler/compra vs. suscripción) — Sección 11 del documento de esquema, pendiente #5, sin resolver.
- Cualquier variante `(public)`/sin sesión de `/recomendaciones` — esta pantalla vive enteramente dentro de `(app)`; no hay equivalente público según la tabla de rutas de `ARCHITECTURE.md`.
- UI de umbrales configurables por admin — `RECOMMENDATION_THRESHOLDS` es una constante estática de código en este ticket, no una pantalla de configuración.

---

## Plan de implementación

**Objetivo:** Calcular y renderizar `/recomendaciones` como dos bloques en vivo — watchlist disponible (consulta 8.1) y descubrimiento (consulta 8.2 + extensión de género) — respaldados por una capa de consultas y acciones de escritura compartida y reusable, con los umbrales tomados de `constants/recommendationThresholds.ts` en vez de números mágicos inline.

**En alcance:**

1. `constants/recommendationThresholds.ts` — `minRating`, `minImdbVotes`, `minVotesFloor`.
2. `services/RecommendationServices` — `getWatchlistAvailable({ genreSlug? })` (consulta 8.1 + join de género) y `getDiscovery({ genreSlug? })` (consulta 8.2 + join de género, umbrales desde el archivo de constantes). Verificar si `RIK-7` ya entregó una implementación de 8.1 y reusarla.
3. `actions/recommendations` — orquestación con verificación de sesión que devuelve `{ watchlistAvailable, discovery }` para la página; `actions/media-status` — `addToWatchlist`, `dismissRecommendation`, ambos con `revalidatePath('/recomendaciones')`.
4. `features/recommendations` — `RecommendationsScreen`, `GenreFilterSelect` (maneja `?genero=`), `DiscoveryCard` (agrega los dos botones de acción alrededor del `MediaCard` compartido).
5. `app/(app)/recomendaciones/page.tsx` — Server Component que conecta searchParams → actions → pantalla.

**Fuera de alcance:** construcción de `/panel`, construcción de `/titulo/[slug]`, "marcar visto" desde esta pantalla, paginación, `offer_type`, variante pública, UI de administración de umbrales — ver arriba.

**Riesgos clave / compatibilidad:**

- `RIK-7` y `RIK-8` necesitan ambos la consulta 8.1 sin orden de dependencia entre ellos — riesgo de implementaciones duplicadas/divergentes si se ejecutan fuera de orden. Revisar `services/` en busca de una implementación existente de 8.1 antes de crear una nueva.
- El `select distinct` en ambas consultas debe sobrevivir al join de género agregado — un título con varios géneros no debe aparecer duplicado.
- `media_availability` y `user_subscriptions` estarán vacías hasta que la ingesta de RIK-3/RIK-4 realmente corra — ambos bloques legítimamente renderizan vacío; se necesita un estado vacío real (no de error), no un spinner de carga atascado para siempre.
- No reintroducir accidentalmente una lista de descubrimiento precalculada/cacheada — el documento de producto exige explícitamente cálculo en vivo (`RIKUNA-PRD-documento-especificacion-rikuna.md`, línea 176) para que marcar visto/descartado tenga efecto inmediato.

**Mapeo de criterios de aceptación:**

| Criterio del ticket | Cobertura de implementación |
| --- | --- |
| El bloque de descubrimiento excluye títulos de la watchlist/vistos/descartados | Los guards `coalesce(...) = false` de `getDiscovery` sobre `watched`, `want_to_watch`, `dismissed` |
| El bloque de descubrimiento respeta el umbral de calificación/votos | `getDiscovery` filtra usando `RECOMMENDATION_THRESHOLDS.minRating` / `minImdbVotes` |
| El filtro de género reduce ambos bloques | Join y filtro de género agregado a `getWatchlistAvailable` y `getDiscovery`, manejado por `?genero=` |
| "No me interesa" persiste y oculta al recargar | `dismissRecommendation` fija `dismissed = true`, `revalidatePath('/recomendaciones')` |
| "Agregar a watchlist" mueve un título al bloque (a) en la siguiente carga | `addToWatchlist` fija `want_to_watch = true`, `revalidatePath('/recomendaciones')`; la consulta del bloque (a) luego lo incluye |

---

## Prompt para Claude Code

```xml
<task id="RIK-8" title="Recomendaciones por descubrimiento" depends_on="RIK-1, RIK-2, RIK-3, RIK-6">
  <role>
    You are a senior full-stack engineer working on Rikuna (Next.js 16 App Router + React 19 + TypeScript,
    Supabase/Postgres backend). Follow the project's layered + feature-sliced architecture exactly.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — full layered + feature-sliced layout, auth boundaries ((app)/(public)/(auth) route
      groups), the Server Actions and Services tables, and the constants/recommendationThresholds.ts mention
      (line ~206).</item>
    <item>AGENTS.md — this is a customized Next.js version; read the relevant guide under
      node_modules/next/dist/docs/ (resolved relative to AGENTS.md's directory) before writing any Next.js code.
      At minimum read node_modules/next/dist/docs/01-app/02-guides/server-actions.md,
      node_modules/next/dist/docs/01-app/02-guides/forms.md, and
      node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the commit_message
      deliverable below.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 2.2 (genres/media_genres, lines 72–104),
      Section 3.3 (media_availability), Section 4 (user_subscriptions), Section 5 (user_media_status,
      including the watched/want_to_watch independence rule at line 257), Section 8.1 (lines 361–381,
      "Qué ver este mes"), Section 8.2 (lines 385–404, discovery query — the exact base query to extend),
      Section 9 (RLS summary).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 1 (design system: style "base-lyra", base color
      "mist") and Section 2.2's /recomendaciones entry (lines 108–114) for the two-block layout, genre Select
      placement, and the "No me interesa" button treatment.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — line 176: recommendations must be computed live
      by the app per request, never precalculated/cached, so that marking watched/dismissed has immediate
      effect.</item>
    <item>specs/backlog/RIK-1_database_schema_rls.md — confirms the schema is implemented verbatim from the PRD
      schema doc with no renames relevant to this ticket; read its "Claude Code prompt" ground_truth_db_notes
      for the exact migration file names actually created.</item>
    <item>supabase/migrations/ — read the latest migration files (created by RIK-1) to confirm the live column
      names, types and RLS policies before writing any query against them.</item>
    <item>services/, actions/recommendations/, actions/media-status/, features/panel/ (if present) — check
      whether a parallel RIK-7 implementation already created a shared implementation of query 8.1
      ("Qué ver este mes"); if so, reuse it instead of duplicating the query.</item>
    <item>components/MediaCard/ — the shared poster+title+year+rating card component to reuse for both blocks.</item>
    <item>CHANGELOG.md — format and where to append the entry for this ticket.</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna cross-references a user's IMDb watch history against what's currently available on their active
    streaming subscription. This ticket builds /recomendaciones: two blocks. Block (a) is a subset of "Qué ver
    este mes" (watchlist titles available now on the user's active subscription, query 8.1) — reuse an existing
    implementation if one already exists from RIK-7's parallel track, otherwise implement it fresh in a way
    RIK-7 can reuse later. Block (b) is "Descubre algo nuevo" (query 8.2): well-rated, available, unseen titles
    outside the watchlist, extended with a genre filter that the base query does not have.

    No new database columns are needed — every field this ticket reads/writes already exists per schema doc
    Sections 2.1, 2.2, 3.3, 4 and 5: media_items.imdb_rating, media_items.imdb_votes, media_availability.is_available,
    user_subscriptions.ended_on, user_media_status.watched/want_to_watch/dismissed, media_genres/genres.slug.

    The 7.0 rating / 5000 votes thresholds in query 8.2 must NOT be left as inline magic numbers. Create
    constants/recommendationThresholds.ts exporting RECOMMENDATION_THRESHOLDS = { minRating: 7.0,
    minImdbVotes: 5000, minVotesFloor: 5000 } and read from it in the discovery query. minVotesFloor mirrors
    minImdbVotes today; it exists because ARCHITECTURE.md already names it, but it is not otherwise exercised
    by this ticket's logic.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ does not exist in this repo until RIK-1 lands. Do not invent table/column names —
      read the actual migration files RIK-1 produces (or, if still absent, treat
      specs/RIKUNA-PRD-schema-basedatos-rikuna.md Sections 2–5 as ground truth, since RIK-1's own spec confirms
      it copies that DDL verbatim).</note>
    <note>The verbatim query 8.2 in the schema doc has NO genre filter or join. Adding one via media_genres/genres
      is this ticket's own required extension — do not present it as "the query as documented."</note>
    <note>media_genres and genres both allow public read (same RLS group as media_items) — the genre join does
      not need a service-role client; it works fine under the end user's own RLS-scoped session.</note>
    <note>user_media_status.watched and want_to_watch are independent booleans. If a title is both watched=true
      and want_to_watch=true, watched wins and it must NOT appear in either block — both queries already encode
      this via coalesce(ums.watched, false) = false, keep that guard intact.</note>
    <note>Do not import lib/supabase/admin.ts anywhere in this ticket's code — /recomendaciones is a fully
      user-facing, session-scoped screen; RLS via the user's own auth.uid() must do the filtering, not a
      service-role bypass.</note>
    <note>Do not add a new "recommendations" or "discovery" table. This is a computed read, never persisted —
      product spec explicitly requires live computation on every request so that marking a title
      watched/dismissed has immediate effect (RIKUNA-PRD-documento-especificacion-rikuna.md, line 176).</note>
    <note>RIK-8 depends on RIK-1, RIK-2, RIK-3, RIK-6 per the sibling backlog, but NOT on RIK-7 — the panel
      screen may or may not exist yet when this ticket runs. Check for an existing shared implementation of
      query 8.1 before creating a new one; do not silently duplicate it.</note>
  </ground_truth_db_notes>

  <story>
    Como usuario con una suscripción activa declarada, quiero ver, además de mi "Qué ver este mes", una sección
    de descubrimiento con títulos bien calificados y disponibles que aún no conozco ni tengo en mi lista, poder
    filtrarlos por género, y poder marcarlos como "no me interesa" o agregarlos a mi watchlist directamente desde
    la tarjeta, para decidir qué ver a continuación sin salir de la pantalla de recomendaciones.
  </story>

  <requirements>
    <phase title="Constants">
      <item>Create constants/recommendationThresholds.ts exporting RECOMMENDATION_THRESHOLDS = { minRating: 7.0,
        minImdbVotes: 5000, minVotesFloor: 5000 } as const.</item>
    </phase>

    <phase title="Services">
      <item>Check services/ for an existing implementation of query 8.1 (possibly created by a parallel RIK-7
        run). If found, reuse it. If not, create services/RecommendationServices/index.ts exporting a class that
        accepts a SupabaseClient in its constructor (dependency-injected, per ARCHITECTURE.md's service pattern)
        with:
        - getWatchlistAvailable(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; — query 8.1, extended
          with an optional genre join/filter, preserving DISTINCT.
        - getDiscovery(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; — query 8.2, using
          RECOMMENDATION_THRESHOLDS.minRating / minImdbVotes instead of inline numbers, extended with the same
          optional genre join/filter, preserving DISTINCT and the limit 50 cap.</item>
      <item>Row-map results into the existing MediaItem type from types/index.ts. Do not duplicate query shapes
        or row mapping in actions/ or in the UI layer.</item>
    </phase>

    <phase title="Actions">
      <item>Create or extend actions/recommendations/index.ts with a session-checked server function (e.g.
        getRecommendations(genreSlug?: string)) that verifies supabase.auth.getUser(), instantiates
        RecommendationServices with that same request-scoped client, and returns
        { watchlistAvailable: MediaItem[], discovery: MediaItem[] }.</item>
      <item>Create or extend actions/media-status/index.ts ("use server") with:
        - addToWatchlist(mediaId: string): Promise&lt;void&gt; — session check, upsert user_media_status with
          want_to_watch: true, manually_edited: true, source: 'manual', then revalidatePath('/recomendaciones')
          (and revalidatePath('/panel') if that route already exists).
        - dismissRecommendation(mediaId: string): Promise&lt;void&gt; — same pattern, dismissed: true.
        Structure both so RIK-7 (mark watched from panel card) and RIK-9 (title detail actions) can add sibling
        functions to this same module later without restructuring it.</item>
    </phase>

    <phase title="Features">
      <item>Create features/recommendations/RecommendationsScreen.tsx — a client or server composition component
        (per the project's "Server Components fetch, pass initial data to client feature components" pattern)
        rendering the two labeled blocks: "De tu lista de seguimiento, disponibles ahora" and "Descubre algo
        nuevo", per RIKUNA-PRD-vistas-y-estilo-rikuna.md Section 2.2.</item>
      <item>Create features/recommendations/GenreFilterSelect.tsx — a client component rendering a shadcn Select
        of genres (fetch all genres, ordered by name), that updates the ?genero=&lt;slug&gt; search param on the
        current route when changed (e.g. via useRouter + useSearchParams from next/navigation).</item>
      <item>Create features/recommendations/DiscoveryCard.tsx — wraps the shared components/MediaCard with two
        actions: "Agregar a watchlist" (calls addToWatchlist) and a discreet "No me interesa" icon button (calls
        dismissRecommendation), per the Section 2.2 UI notes. Both actions should show a loading/pending state and
        a toast (Sonner, per ARCHITECTURE.md) confirming the result.</item>
    </phase>

    <phase title="Routes">
      <item>Create app/(app)/recomendaciones/page.tsx as a Server Component. Read searchParams.genero (a genre
        slug or undefined), call the actions/recommendations function, and render RecommendationsScreen with the
        two result arrays and the current genre filter value. This route must live inside the existing (app)
        route group so the session guard already documented in ARCHITECTURE.md applies — do not add new
        middleware logic for this ticket.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">The "Descubre algo nuevo" block never includes a title that is on the user's watchlist
      (want_to_watch = true), already watched (watched = true), or dismissed (dismissed = true). Verify: seed a
      test user with one title in each state plus one eligible title, call getDiscovery, and confirm only the
      eligible title is returned.</criterion>
    <criterion id="AC-2">The discovery block excludes titles with imdb_rating &lt; RECOMMENDATION_THRESHOLDS.minRating
      or imdb_votes &lt; RECOMMENDATION_THRESHOLDS.minImdbVotes. Verify: seed one title at 6.9/10000 and one at
      7.0/4999, confirm both are excluded from getDiscovery's result; seed one at 7.0/5000, confirm it is
      included.</criterion>
    <criterion id="AC-3">Selecting a genre in the Select filters both blocks to titles carrying that genre only.
      Verify: seed two eligible discovery titles and one eligible watchlist-available title with different
      genres, select one genre in the UI (or call both service methods with genreSlug set), and confirm each
      block only returns titles tagged with that genre via media_genres/genres.</criterion>
    <criterion id="AC-4">Clicking "No me interesa" on a discovery card sets user_media_status.dismissed = true
      for that (user, media) pair, and the title does not reappear in the discovery block after a full page
      reload. Verify: call dismissRecommendation, then re-run getDiscovery (or reload /recomendaciones) and
      confirm the title is absent.</criterion>
    <criterion id="AC-5">Clicking "Agregar a watchlist" on a discovery card sets
      user_media_status.want_to_watch = true, and on the next load of /recomendaciones that title appears in
      block (a) (assuming it is also available on the user's active subscription) and no longer appears in block
      (b). Verify: call addToWatchlist, reload, confirm presence in getWatchlistAvailable and absence from
      getDiscovery.</criterion>
    <criterion id="AC-6">The 7.0 / 5000 thresholds are not hardcoded inline in the query/service — they are read
      from constants/recommendationThresholds.ts. Verify: grep services/RecommendationServices for the literals
      7.0 and 5000; they must not appear outside constants/recommendationThresholds.ts.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create any new database table or column. Every field used here already exists per schema doc
      Sections 2.1, 2.2, 3.3, 4, 5.</item>
    <item>Do NOT hardcode 7.0 or 5000 anywhere outside constants/recommendationThresholds.ts.</item>
    <item>Do NOT import lib/supabase/admin.ts from any file touched in this ticket — this is entirely a
      user-facing, RLS-scoped flow.</item>
    <item>Do NOT rename or bypass user_media_status.watched, want_to_watch, or dismissed — reuse them exactly as
      named.</item>
    <item>Do NOT duplicate the write logic for user_media_status in the UI layer or inline in the route —
      addToWatchlist/dismissRecommendation must live in actions/media-status/ so RIK-7 and RIK-9 can reuse them.</item>
    <item>Do NOT place /recomendaciones outside the (app) route group and do NOT add a (public) variant — there
      is no unauthenticated version of this screen per ARCHITECTURE.md's routes table.</item>
    <item>Do NOT lose the select distinct semantics on either query when adding the genre join — a title with
      multiple genres must not be returned twice.</item>
    <item>Do NOT build a cached/precomputed discovery list — recompute on every request per the product spec's
      explicit live-computation requirement.</item>
    <item>If services/RecommendationServices (or an equivalent already covering query 8.1) already exists from a
      parallel RIK-7 implementation, extend/reuse it — do not create a second, divergent implementation of the
      same query.</item>
  </constraints>

  <out_of_scope>
    <item>The /panel screen itself (RIK-7) — only its underlying query 8.1 result is needed here.</item>
    <item>The /titulo/[slug] detail screen (RIK-9) — cards here only need to link to it.</item>
    <item>"Marcar visto" action from a recommendation card — not required by this ticket's acceptance criteria.</item>
    <item>Pagination or infinite scroll beyond the existing limit 50 on the discovery query.</item>
    <item>offer_type (rental/purchase vs. subscription) distinctions — schema doc Section 11, unresolved.</item>
    <item>Any admin/settings UI for changing the recommendation thresholds at runtime.</item>
  </out_of_scope>

  <implementation_notes>
    <item>constants/recommendationThresholds.ts:
      export const RECOMMENDATION_THRESHOLDS = { minRating: 7.0, minImdbVotes: 5000, minVotesFloor: 5000 } as const;</item>
    <item>services/RecommendationServices/index.ts:
      class RecommendationServices { constructor(private supabase: SupabaseClient) {}
      async getWatchlistAvailable(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; { ... }
      async getDiscovery(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; { ... } }</item>
    <item>actions/recommendations/index.ts:
      export async function getRecommendations(genreSlug?: string): Promise&lt;{ watchlistAvailable: MediaItem[]; discovery: MediaItem[] }&gt;</item>
    <item>actions/media-status/index.ts:
      export async function addToWatchlist(mediaId: string): Promise&lt;void&gt;
      export async function dismissRecommendation(mediaId: string): Promise&lt;void&gt;</item>
    <item>app/(app)/recomendaciones/page.tsx signature:
      export default async function RecomendacionesPage({ searchParams }: { searchParams: Promise&lt;{ genero?: string }&gt; })
      — remember Next.js 16's async searchParams/params convention; confirm the exact API against the
      mandatory_reading Next.js docs before writing this, since this project's Next.js version may differ from
      training-data assumptions per AGENTS.md.</item>
  </implementation_notes>

  <clarify_before_coding>
    <item>Whether services/RecommendationServices already exists from a parallel RIK-7 run — default: check
      first, reuse if present, otherwise create it structured for RIK-7 to reuse later.</item>
    <item>Exact value/use of minVotesFloor in constants/recommendationThresholds.ts — default: set equal to
      minImdbVotes (5000), unused by this ticket's own logic, reserved for a future tunable minImdbVotes.</item>
    <item>Genre filter state mechanism (URL search param vs. Zustand store) — default: ?genero=&lt;slug&gt; search
      param read server-side, no client store needed for this ticket.</item>
    <item>Genre dropdown source (all genres vs. only genres present in eligible titles) — default: all rows from
      genres, ordered by name.</item>
    <item>Two-block layout mechanics (Tabs vs. stacked blocks) — default: two stacked blocks, per
      RIKUNA-PRD-vistas-y-estilo-rikuna.md Section 2.2's explicit either/or allowance.</item>
  </clarify_before_coding>

  <deliverables>
    <item>All files listed in the requirements phases above, created or extended.</item>
    <item>Run npm run lint (and any tests, if a test setup exists by the time this runs) and fix any issues
      introduced by this change.</item>
    <item>Persist documentation per the completion_report persistence block below.</item>
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
        <item>Format: `- RIK-8: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-8_discovery_recommendations.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to discovery_recommendations, matching specs/backlog/RIK-8_discovery_recommendations.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-8_discovery_recommendations.md in the metadata table.</item>
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
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Translate them into product language (for example say "the recommendations page" instead of naming the component, "the dismiss action" instead of naming columns).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots — include a "## Screenshots" section since this ticket has user-visible UI changes. Omit only if truly nothing renders differently.</item>
      <item>Do NOT embed images in the markdown — attachments are added by the human. Instead, list what to capture as numbered items, each with: screen/area name, auth state if relevant, and what the screenshot should show. Suggest items like: "Recommendations page — logged in with active subscription: both blocks populated, genre filter visible" and "Discovery card — after clicking 'No me interesa': card removed from the list on reload."</item>
      <item>Suggest 1–4 screenshots max — only views that prove the AC.</item>
      <item>Prefix each screenshot line with a placeholder the poster can replace after attaching: `[attach: short label]` so they know which file goes where.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works. This ticket is UI + logic, so include both the UI validation and Logic validation sections (no schema/migration change, so omit Database validation unless the implementer added seed data worth checking).</item>
      <item>Structure: "## Prerequisites" (dev server running, a logged-in test user with an active subscription and at least a few media_items/media_availability/genres rows seeded, e.g. via RIK-1's local Supabase instance), then:
        "## UI validation" — numbered steps at /recomendaciones: confirm both blocks render, confirm genre Select narrows both blocks, click "No me interesa" on a discovery card and reload to confirm it's gone, click "Agregar a watchlist" on a discovery card and reload to confirm it now appears in the first block and no longer in the second.
        "## Logic validation" — how to directly call/inspect RecommendationServices.getDiscovery and getWatchlistAvailable (or query user_media_status) to confirm the rating/votes thresholds and the watched/want_to_watch/dismissed exclusions hold with edge-case seed rows.
        then "## Expected outcome" (bullets tying back to AC-1 through AC-6).</item>
      <item>Use the concrete route /recomendaciones. Note this route requires an active session (inside the (app) group) — there is no unauthenticated variant to test.</item>
      <item>SQL must be read-only verification queries — no INSERT/UPDATE/DELETE unless the ticket explicitly required data migration; seeding test rows for validation is fine to mention but should use the app's own actions (addToWatchlist, dismissRecommendation) or documented test fixtures, not raw writes against production-shaped tables.</item>
      <item>Do not duplicate the full PR test plan — this guide is for manual smoke testing after deploy or local run, written for someone who may not have read the PR.</item>
    </deliverable>
  </completion_report>
</task>
```

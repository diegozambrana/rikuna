# RIK-4 — Importación desde IMDb (calificaciones y watchlist)

> Documento de lectura en español. La fuente de verdad es `specs/backlog/RIK-4_imdb_import.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

RIK-4 permite que un usuario autenticado suba su CSV de *Ratings* o *Watchlist* de IMDb en `/importar` y que se procese hacia sus datos personales de Rikuna. Subir *Ratings* marca los títulos coincidentes como `watched = true` con la calificación personal y la fecha de visto; subir *Watchlist* marca `want_to_watch = true` sin tocar `watched`. Los títulos que aún no existen en el catálogo se crean como `media_items` incompletos ("stub") en vez de descartarse, y cada fila queda registrada contra un lote de importación para que el usuario pueda confiar en lo que pasó.

- UI de carga en `/importar`: input de archivo + selector de tipo de origen (Calificaciones / Lista de seguimiento).
- Una Server Action parsea el CSV, hace match/crea `media_items` por `imdb_id`, y hace upsert de `user_media_status`.
- Las filas con `user_media_status.manually_edited = true` quedan protegidas de ser sobrescritas, salvo para completar una calificación vacía.
- Las filas inválidas (`Const` faltante, columnas faltantes) se marcan `skipped` sin abortar el resto del archivo.
- El proceso termina con un resumen inline (total / reconocidos / creados / omitidos) renderizado desde la respuesta de la propia acción — sin recargar la página.
- El comentario del propio ticket traza una línea de alcance explícita: el listado completo del historial de lotes en `/importar` y la tabla de detalle fila por fila de `/importar/[batchId]` son **RIK-5**, no este ticket. Este documento mantiene RIK-4 limitado a carga + procesamiento + resumen inline.

---

## Contexto

### Ticket original

**RIK-4 — Importación desde IMDb (calificaciones y watchlist)**

Descripción: Vista `/importar` con carga de CSV, selector de tipo (Calificaciones / Lista de seguimiento) y procesamiento según la Sección 7.3 del esquema: crea `media_items` como stub (`is_stub = true`) si el `imdb_id` no existe, hace upsert en `user_media_status` (`watched`/`want_to_watch` según el tipo), respeta filas con `manually_edited = true`, y registra cada fila en `imdb_import_batches`/`imdb_import_rows` con su resultado (`matched`/`created`/`skipped`).

Criterios de aceptación:

- Subir el CSV de *Your Ratings* marca cada título como `watched = true` con `personal_rating` y `watched_at`, y crea como stub los que no existían en el catálogo.
- Subir el CSV de *Watchlist* marca `want_to_watch = true` sin tocar `watched` de títulos ya vistos.
- Al terminar el procesamiento se muestra un resumen (total, reconocidos, creados, omitidos) sin necesidad de recargar la página.
- Una fila cuyo `user_media_status.manually_edited = true` no es sobrescrita por la reimportación (salvo completar una calificación vacía).
- Un CSV con filas inválidas (columnas faltantes, `Const` vacío) marca esas filas como `skipped` sin abortar el resto del archivo.

Depende de / bloquea: depende de **RIK-1** (esquema + RLS). Bloquea **RIK-5** (vista de detalle de importación).

> Nota: cada tabla y número de sección que cita el ticket (`media_items`, `user_media_status`, `imdb_import_batches`, `imdb_import_rows`, Secciones 7.1–7.3) fue verificado contra `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` y coincide. `supabase/migrations/` todavía no existe en este repo — este documento asume que la migración de RIK-1 ya está aplicada al momento de implementar RIK-4.

### Comentarios del equipo

Un comentario acompaña este ticket (de la fuente del ticket, tratado como autoritativo sobre la descripción pelada, según las reglas de análisis):

> This is a user-facing action (RLS + anon/authenticated client), NOT `ingestion/admin.ts` — the CSV upload is per-user and must go through the normal server-action path with RLS, unlike RIK-3's admin-only catalog load. The exact CSV column → DB field mapping is given verbatim in schema doc Section 7.2, and the processing logic (ratings vs watchlist, stub creation, `manually_edited` protection) in Section 7.3 — point the coding agent there directly. This ticket covers the upload UI + processing + summary only; the full per-row detail table view (`/importar/[batchId]`) and the import-history list on `/importar` are RIK-5's scope — keep RIK-4 scoped to upload + processing + inline summary, and note the boundary explicitly in Out of scope.

Este comentario cambia dos cosas respecto a la descripción: (1) prohíbe `lib/supabase/admin.ts` para este flujo — todo pasa por el cliente con RLS, a diferencia de la ingesta de catálogo de RIK-3; (2) acota el alcance de `/importar`, ya que `specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md` Sección 2.2 describe `/importar` incluyendo también "historial de importaciones previas con resumen" — ese listado de historial queda explícitamente diferido a RIK-5.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| Ticket dice | Realidad en el código | Impacto |
| --- | --- | --- |
| El procesamiento sigue la Sección 7.3 del esquema | Confirmado verbatim en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` líneas 343–355; las tablas de la Sección 7.1 (líneas 296–325) y el mapeo de CSV de la Sección 7.2 (líneas 329–341) coinciden exactamente. | Es seguro apuntar al agente directamente a estas secciones — no hace falta re-derivarlas. |
| Implica una vista `/importar` completa | `specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md` (línea 145–148) también lista "historial de importaciones previas con resumen" como parte de `/importar`. | Según el propio comentario del ticket, ese listado de historial pertenece a RIK-5. Este documento mantiene `/importar` limitado a carga + selector de tipo + resumen inline; sin listado de lotes, sin `Table` de corridas pasadas. |
| No se señala ningún conflicto de dependencia al escribir `media_items` desde una sesión de usuario | La tabla de RLS de `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 9 (línea 422) lista el acceso de escritura de `media_items`, `genres`, `people` como **"Solo admin / proceso de ingesta"** — pero la Sección 7.3 (la lógica de este mismo ticket) requiere que una importación disparada por el usuario **cree** `media_items` stub (y, según el mapeo de la Sección 7.2, filas de `genres`/`people` para Genres/Directors). | Tensión real dentro del propio PRD: la tabla genérica de RLS y la lógica de importación no coinciden sobre quién puede escribir `media_items`. RIK-4 no puede usar `admin.ts` (según el comentario del equipo) ni puede violar RLS silenciosamente. Se trata como una decisión más abajo — la migración de RIK-1 debe traer una política de INSERT acotada para `authenticated` que permita crear stubs; si no la trae, una migración mínima solo de política es responsabilidad de este ticket, no un bloqueador. |
| Nada de `supabase/`, `types/`, `services/`, `actions/`, `features/`, `ingestion/` existe | Confirmado — base fresca de Create Next App, solo existen `app/`, `components/ui/button.tsx`, `lib/utils.ts`. | Cada capa de esta funcionalidad es nueva; no hay nada que "extender", solo crear, siguiendo el patrón documentado en `ARCHITECTURE.md`. |
| No hay librería de parseo de CSV instalada | `package.json` no tiene ni `papaparse` ni ninguna librería de CSV. | Se necesita una nueva dependencia de runtime (`papaparse`), anotada como decisión más abajo. |
| `components.json` dice `"style": "base-lyra"` | El propio snippet de `components.json` en `specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md` Sección 1.3 todavía dice `"style": "lyra"` (pre-migración). | Solo informativo — no es responsabilidad de este ticket corregirlo, pero cada componente shadcn agregado para esta funcionalidad debe venir del registro **base-lyra** (Base UI), y `components/ui/` hoy solo tiene `button.tsx` — hace falta agregar `Card`, `Input`, `RadioGroup`/`Tabs`, `Progress`, `Alert`, `Table`, `Badge`. |

### Estado actual en la base de datos

Nada de esto existe todavía en `supabase/migrations/` (la carpeta misma no existe) — lo siguiente es lo que se espera que RIK-1 cree, según `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`. Reverificar la migración real ya aplicada antes de escribir código.

**`media_items`** (Sección 2.1) — columnas relevantes: `id uuid pk`, `imdb_id varchar not null unique`, `tmdb_id integer`, `type varchar not null` (solo `'movie' | 'tv'` — validado a nivel de aplicación, sin check constraint en la BD), `title_type varchar` (valor crudo de IMDb), `title varchar not null`, `year integer`, `runtime_minutes integer`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `slug varchar not null unique`, `is_stub boolean default false not null`, `enriched_at timestamptz`.

**`user_media_status`** (Sección 5) — `id uuid pk`, `user_id uuid not null references auth.users`, `media_id uuid not null references media_items`, `watched boolean default false not null`, `watched_at timestamptz`, `personal_rating smallint` (check 1–10), `want_to_watch boolean default false not null`, `want_added_at timestamptz`, `dismissed boolean default false not null`, `source varchar default 'manual' not null`, `manually_edited boolean default false not null`, único `(user_id, media_id)`.

**`imdb_import_batches`** (Sección 7.1) — `id uuid pk`, `user_id uuid not null`, `source_type varchar not null` (`'ratings' | 'watchlist'`), `file_name varchar`, `status varchar default 'pending' not null` (sin enum constraint en el documento), `total_rows`, `matched_rows`, `created_rows`, `skipped_rows` (todos `integer default 0 not null`), `completed_at timestamptz`.

**`imdb_import_rows`** (Sección 7.1) — `id uuid pk`, `batch_id uuid not null references imdb_import_batches`, `imdb_id varchar not null`, `title varchar`, `title_type varchar`, `year integer`, `your_rating smallint`, `date_rated date`, `media_id uuid references media_items`, `result varchar default 'pending' not null` (`'matched' | 'created' | 'skipped'`).

**RLS** (Sección 9): `user_media_status`, `imdb_import_batches`, `imdb_import_rows` son solo del dueño (`auth.uid() = user_id`, patrón de la Sección 9.1) — lectura Y escritura. `media_items`, `genres`, `people` figuran como lectura pública, escritura admin/ingesta — ver la discrepancia arriba respecto a la creación de stubs.

**Uso en código:** ninguno — nada lee ni escribe estas tablas todavía; este ticket es terreno nuevo para la ruta de importación.

### Lógica actual (ingestion/imdb-import)

No existe. No hay comportamiento actual contra el cual comparar — es un módulo nuevo. La Sección 7.3 del documento de esquema (verbatim, debe implementarse exactamente):

```
CSV de calificaciones (ratings) → lo que YA VISTE:
1. Buscar media_items por imdb_id. Si no existe → crear con los datos del CSV, is_stub = true, result = 'created'. Si existe → result = 'matched'.
2. Upsert en user_media_status: watched = true, watched_at = Date Rated, personal_rating = Your Rating, source = 'imdb_ratings'.
3. No sobrescribir filas con manually_edited = true, salvo para agregar la calificación si estaba vacía.

CSV de lista de seguimiento (watchlist) → lo que QUIERES VER:
1. Mismo paso 1 (crear stub si no existe).
2. Upsert en user_media_status: want_to_watch = true, want_added_at, source = 'imdb_watchlist'.
3. No tocar watched — si ya estaba marcado como visto, se respeta.

Reconciliación de bajas (decisión pendiente): cuando un título estaba en want_to_watch por una importación
previa y ya no aparece en el archivo nuevo, hay dos opciones: (a) desmarcarlo automáticamente, o (b)
conservarlo y solo reportarlo. Recomiendo (b) en la etapa inicial, para no perder datos por un archivo
mal exportado.
```

El PRD ya recomienda la opción (b) para la pregunta de "bajas" — este documento la adopta como default (sin desmarcado automático), coincidiendo con el propio principio de "no perder datos del usuario" del documento de producto (`specs/RIKUNA-PRD-documento-especificacion-rikuna.md` línea 183).

### Mapeo de campos solicitados

Sección 7.2, verbatim, aplicada contra las columnas reales de arriba:

| Campo solicitado (columna CSV) | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| `Const` | string (tconst) | `media_items.imdb_id`, `imdb_import_rows.imdb_id` | ya existe (reusar) — requerido para que la fila sea válida |
| `Title` | string | `media_items.title`, `imdb_import_rows.title` | ya existe (reusar) |
| `Title Type` | string | `media_items.title_type` (crudo), `imdb_import_rows.title_type` | ya existe (reusar); debe mapearse localmente a `media_items.type` (`'movie'` / `'tv'`) — no existe ese mapeo todavía, hay que crearlo |
| `Year` | integer | `media_items.year`, `imdb_import_rows.year` | ya existe (reusar) |
| `IMDb Rating` | numeric(3,1) | `media_items.imdb_rating` | ya existe (reusar) |
| `Num Votes` | integer | `media_items.imdb_votes` | ya existe (reusar) |
| `Runtime (mins)` | integer | `media_items.runtime_minutes` | ya existe (reusar) |
| `Genres` | string separado por comas | `genres` + `media_genres` (join) | ya existe (reusar) — crear filas de género por nombre/slug si faltan |
| `Directors` | string separado por comas | `people` + `media_people` (rol `'director'`) | ya existe (reusar) — el CSV no trae `nconst`, hacer match/crear `people` solo por nombre recortado, `imdb_id` queda nulo |
| `Your Rating` | smallint 1–10 | `user_media_status.personal_rating`, `imdb_import_rows.your_rating` | ya existe (reusar) |
| `Date Rated` | date | `user_media_status.watched_at` (timestamptz), `imdb_import_rows.date_rated` (date) | ya existe (reusar); convertir date → timestamptz |
| *(resultado de fila)* | enum | `imdb_import_rows.result`, `imdb_import_batches.{matched,created,skipped,total}_rows` | ya existe (reusar) |
| *(protección de sobrescritura)* | boolean | `user_media_status.manually_edited` | ya existe (reusar) — de solo lectura para este ticket, nunca se pone en `true` aquí |

No se requieren columnas nuevas en ningún lado. Lo único genuinamente nuevo es la tabla de mapeo `title_type` → `type`, que es lógica de aplicación, no esquema.

### Archivos impactados

- **migration**: ninguna esperada — ver la brecha de RLS de escritura de stubs arriba; solo si la migración de RIK-1 ya aplicada carece de una política INSERT para `authenticated` en `media_items`/`genres`/`media_genres`/`people`/`media_people`, este ticket agrega una migración mínima solo de política.
- **types**: `types/index.ts` (nuevo/extendido) — agregar `ImdbImportBatch`, `ImdbImportRow`, `ImdbCsvSourceType`; reusar `MediaItem`, `UserMediaStatus`.
- **constants**: `constants/imdbTitleTypeMap.ts` (nuevo) — mapa `title_type` crudo → `'movie' | 'tv'`.
- **lib**: `lib/slug.ts` (nuevo) — generador de slug con sufijo anti-colisión para `media_items` stub (las filas del CSV nunca traen slug, y `media_items.slug` es único y no nulo).
- **ingestion**: `ingestion/imdb-import/` (nuevo) — `parseCsv.ts` (wrapper de papaparse + validación de filas), `processRow.ts` (lógica de la Sección 7.3, ramificada por `source_type`), todo operando sobre el cliente con RLS, nunca `admin.ts`.
- **services**: `services/ImdbImportServices/index.ts` (nuevo) — `createBatch`, `insertRow`, `findOrCreateMediaItem`, `upsertUserMediaStatus` (con el guard de `manually_edited`), `finalizeBatch`; actualizar el barrel `services/index.ts`.
- **actions**: `actions/imdb-import/index.ts` (nuevo) — Server Action `importImdbCsv(prevState, formData)`: chequeo de sesión, validación de archivo + tipo de origen, delega a ingesta, `revalidatePath` en las pantallas afectadas por el estado, devuelve el resumen consumido por `useActionState`.
- **features**: `features/import/` (nuevo) — `UploadForm.tsx` (cliente, `useActionState`, selector de tipo, input de archivo), `ImportSummary.tsx` (Alert + contadores, renderizado desde el estado de la acción).
- **components**: `components/ui/` — agregar `card`, `input`, `radio-group` (o `tabs`), `progress`, `alert`, `table`, `badge` vía el CLI de shadcn (estilo base-lyra); ninguno existe todavía salvo `button.tsx`.
- **app routes**: `app/(app)/importar/page.tsx` (nuevo) — cascarón de Server Component que renderiza solo `<UploadForm />` (sin tabla de historial — RIK-5).
- **config**: `next.config.ts` — agregar `experimental.serverActions.bodySizeLimit` (el tope por defecto es 1MB; los históricos de calificaciones de IMDb pueden superarlo).
- **package.json**: agregar `papaparse` (dependency) y `@types/papaparse` (devDependency).
- **tests**: no existen todavía en el repo; si se agrega una suite, la lógica de mapeo/validación de filas en `ingestion/imdb-import/` es el objetivo de mayor valor.

### Decisiones tomadas

1. **Librería de parseo de CSV: `papaparse`.** No hay librería de CSV instalada. El parseo ocurre del lado del servidor, dentro de la Server Action (leyendo el texto del `File` subido), no del lado del cliente, para que la validación y los contadores queden en una sola fuente. Default recomendado, sin confirmar.
2. **Mapeo `title_type` → `type`**, dado que `media_items.type` no es nulo y solo acepta `'movie' | 'tv'`: `movie`, `tvMovie` → `'movie'`; `tvSeries`, `tvMiniSeries` → `'tv'`; `short` → `'movie'`. Vive en `constants/imdbTitleTypeMap.ts`. Default recomendado, sin confirmar.
3. **Generación de slug para `media_items` stub**: kebab-case(`title`) + `-` + `year` (cuando existe), con un sufijo corto de desambiguación ante colisión de constraint único (reintentar, no pre-chequear). Nuevo helper `lib/slug.ts` — reusable después por la ingesta de catálogo de RIK-3. Default recomendado, sin confirmar.
4. **El enlace de género/director queda en alcance para la creación de stubs.** La Sección 7.2 mapea explícitamente `Genres` y `Directors`; la Sección 7.3 dice "crear con los datos del CSV", lo cual se interpreta como incluyéndolos. Los valores de `Directors` se hacen match/crean en `people` solo por nombre recortado (`imdb_id` queda nulo — el CSV de ratings/watchlist no trae `nconst` para directores). Default recomendado, sin confirmar — podría sacarse de alcance para reducir el tamaño de este ticket si el equipo no está de acuerdo.
5. **Brecha de RLS en el catálogo (escrituras de media_items/genres/media_genres/people/media_people desde una sesión de usuario).** La tabla genérica de RLS de la Sección 9 dice que estas son solo de escritura admin/ingesta, pero la Sección 7.3 requiere creación de stubs disparada por el usuario, y el comentario del equipo prohíbe `admin.ts` aquí. Default recomendado: verificar si la migración de RIK-1 ya aplicada otorga a `authenticated` una política INSERT acotada (ej. `media_items with check (is_stub = true)`); si no, RIK-4 agrega una migración mínima solo de política (sin cambios de tabla/columna) en vez de recurrir al cliente con rol de servicio. Señalar esto de forma prominente en el reporte de finalización sin importar qué rama se tomó. **Sin confirmar — necesita verificarse contra la migración real de RIK-1 al momento de implementar.**
6. **Ciclo de vida de `imdb_import_batches.status`**: el procesamiento es síncrono dentro de la petición/respuesta de la Server Action (sin cola/job en segundo plano en este ticket), así que el estado pasa directamente de `'pending'` → `'completed'` (o `'failed'` solo ante un error irrecuperable, ej. un archivo imposible de parsear). No se persiste un estado intermedio `'processing'`, ya que no hay UI de polling en RIK-4. Default recomendado, sin confirmar.
7. **`result` y `manually_edited` son independientes.** `imdb_import_rows.result` refleja únicamente el resultado de match/creación/fila-inválida de `media_items`. Una fila puede ser `result = 'matched'` o `'created'` incluso cuando su escritura en `user_media_status` se omitió por `manually_edited = true` — no deben confundirse en la implementación. Confirmado al releer con cuidado la Sección 7.3; más que una "decisión" es una aclaración, pero es fácil de implementar mal.
8. **Reconciliación de "bajas"**: se adopta la opción (b) que el propio PRD recomienda — no desmarcar automáticamente `want_to_watch` para títulos ausentes en un CSV de Watchlist reimportado; solo el reporte futuro (RIK-5) lo expone. Confirmado por el propio documento de esquema (Sección 7.3), no es una pregunta abierta para este ticket.
9. **Origen de `want_added_at`**: usar la propia columna de fecha del CSV si está presente en la exportación (las exportaciones de watchlist de IMDb suelen incluir una columna `Created`), si no, usar `now()` al momento de la importación. Default recomendado, sin confirmar — bajo riesgo de cualquier forma.
10. **Validación de columnas requeridas para AC-5**: una fila es inválida (→ `result = 'skipped'`, sin escritura en `media_items`/`user_media_status`) cuando `Const` está vacío/faltante O `Title` está vacío/faltante (`media_items.title` no es nulo). Otras columnas opcionales faltantes (ej. `Genres` vacío) no invalidan la fila. Default recomendado, sin confirmar.

### Fuera de alcance

- **`/importar/[batchId]`** tabla de detalle completa fila por fila — RIK-5.
- **Listado de historial de importación** en `/importar` (lotes pasados con fecha/tipo/resultado) — RIK-5, según el propio comentario del ticket.
- **Enriquecimiento de stubs** (poster, sinopsis, elenco) para títulos `is_stub = true` — un proceso futuro separado (Sección 11.3 del documento de esquema).
- **Desmarcado automático en "bajas" de watchlist** — deliberadamente no implementado (opción (b) recomendada por el PRD).
- **Procesamiento en segundo plano/con cola** — este ticket procesa de forma síncrona dentro de la petición/respuesta de la Server Action; los archivos grandes simplemente tardan más, no obtienen una cola de trabajos.
- **Cualquier UI fuera de `/importar`** — las pantallas de panel/biblioteca/recomendaciones que leen `user_media_status` solo se revalidan, no se modifican.

---

## Plan de implementación

**Objetivo:** levantar de punta a punta la ruta de importación de CSV de IMDb por usuario — UI de carga, Server Action con RLS, y lógica de procesamiento de la Sección 7.3 — contra el esquema real de `media_items` / `user_media_status` / `imdb_import_batches` / `imdb_import_rows` de RIK-1, deteniéndose en el resumen inline (sin listado de historial, sin vista de detalle).

**En alcance** (orden de rebanada vertical):

1. Verificar que la migración de RIK-1 ya aplicada coincide con las columnas/RLS asumidas arriba, incluyendo la política de escritura para creación de stubs en `media_items`/`genres`/`people` (Decisión 5) — agregar una migración mínima solo de política si falta.
2. Types: `ImdbImportBatch`, `ImdbImportRow`, `ImdbCsvSourceType` en `types/index.ts`.
3. `constants/imdbTitleTypeMap.ts` y `lib/slug.ts`.
4. `ingestion/imdb-import/` — parseo de CSV (papaparse) + validación de filas + procesamiento de la Sección 7.3 (ramas de ratings y watchlist).
5. `services/ImdbImportServices` — persistencia de lotes/filas, `findOrCreateMediaItem`, `upsertUserMediaStatus` con el guard de `manually_edited` y la excepción de completar calificación vacía.
6. `actions/imdb-import` — Server Action `importImdbCsv`: chequeo de sesión, validación, delega a ingesta, `revalidatePath('/panel')` / `/biblioteca` / `/recomendaciones`, devuelve el resumen.
7. `features/import/UploadForm.tsx` + `ImportSummary.tsx` usando `useActionState`, más los primitivos shadcn base-lyra faltantes (`card`, `input`, `radio-group`/`tabs`, `progress`, `alert`, `table`, `badge`).
8. `app/(app)/importar/page.tsx` — cascarón delgado que renderiza solo la funcionalidad de carga.
9. `next.config.ts` — subir `experimental.serverActions.bodySizeLimit` para exportaciones de calificaciones más grandes.
10. `package.json` — agregar `papaparse` / `@types/papaparse`.

**Fuera de alcance:** ver arriba — listado de historial, detalle `[batchId]`, enriquecimiento de stubs, reconciliación de desmarcado automático, jobs en segundo plano.

**Riesgos clave / compatibilidad:**

- La brecha de RLS en `media_items`/`genres`/`people` (Decisión 5) es el mayor riesgo — puede bloquear silenciosamente toda creación de stubs si no se verifica.
- `media_items.slug` e `.imdb_id` son ambos únicos — importaciones concurrentes de títulos superpuestos (ej. el mismo título en un CSV de ratings y uno de watchlist en la misma sesión) no deben generar carrera; el upsert por `imdb_id` con reintento ante violación de único es más seguro que select-luego-insert.
- El tope por defecto de 1MB en el body de Server Actions truncará/rechazará silenciosamente CSVs más grandes si no se sube.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | rama de ratings de `processRow.ts` + `upsertUserMediaStatus` |
| AC-2 | rama de watchlist de `processRow.ts` (nunca toca `watched`) |
| AC-3 | valor de retorno de `importImdbCsv` + `useActionState` en `UploadForm`/`ImportSummary` |
| AC-4 | guard de `manually_edited` de `upsertUserMediaStatus` + excepción de calificación vacía |
| AC-5 | `parseCsv.ts` / validación de filas antes de cualquier escritura en BD |
| AC-6 | solo cliente con RLS, ausencia verificada de imports de `admin.ts` |

---

## Prompt para Claude Code

```xml
<task id="RIK-4" title="Importación desde IMDb (calificaciones y watchlist)" depends_on="RIK-1">

  <role>
    Senior full-stack engineer on Rikuna (Next.js 16 App Router + React 19 + Supabase). You are
    implementing the user-facing IMDb CSV import feature: upload UI, Server Action, and processing
    logic that creates/matches media_items and writes user_media_status, per the project's
    layered + feature-sliced architecture.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, auth boundaries, ingestion vs. admin.ts boundary, routing groups.</item>
    <item>AGENTS.md — this is NOT the Next.js you know; read the docs under node_modules/next/dist/docs/ before writing any Next.js-specific code.</item>
    <item>node_modules/next/dist/docs/01-app/02-guides/server-actions.md — current Server Action patterns, body size limit config (`experimental.serverActions.bodySizeLimit`), CSRF/origin checks.</item>
    <item>node_modules/next/dist/docs/01-app/02-guides/forms.md — current `useActionState` pattern for forms with pending state and returned validation/result state (this project's React is 19, do not use the deprecated `useFormState`).</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the commit_message deliverable.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 2.1 (media_items), Section 5 (user_media_status), Section 7.1 (imdb_import_batches/imdb_import_rows DDL), Section 7.2 (CSV column mapping, verbatim), Section 7.3 (processing logic, verbatim — implement exactly), Section 9 (RLS, owner_all pattern and the media_items/genres/people write-access row).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 1.5 (shadcn component suggestions: "Subida de CSV", "Resumen de importación") and Section 2.2 (/importar screen description — implement ONLY upload + type selector + inline summary, the history list described there is RIK-5).</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — feature list items on importing ratings/watchlist, and the "no perder datos del usuario" / transparency principles that motivate the manually_edited guard and the skip-don't-abort row handling.</item>
    <item>supabase/migrations/ — read the actual latest migration file(s) FIRST. Confirm real column names/types/defaults/constraints for media_items, user_media_status, imdb_import_batches, imdb_import_rows, genres, media_genres, people, media_people, and confirm whether an authenticated-role INSERT policy exists on media_items/genres/media_genres/people/media_people for stub creation (see ground_truth_db_notes below) before writing any query.</item>
    <item>CHANGELOG.md — format and where to append entries.</item>
    <item>specs/logs/README.md — work log filename and template.</item>
  </mandatory_reading>

  <context>
    Rikuna is a fresh Next.js 16 + React 19 + TypeScript project (Create Next App base). NONE of
    supabase/, types/, services/, actions/, features/, ingestion/, hooks/, stores/, constants/,
    middleware.ts exist yet in this repo at spec time. This ticket (RIK-4) depends on RIK-1, which
    creates the full schema and RLS (media_items, user_media_status, imdb_import_batches,
    imdb_import_rows, genres, media_genres, people, media_people, and the RLS policies for all of
    them) — assume RIK-1 has landed as a migration under supabase/migrations/ before you start, and
    read that real migration file rather than trusting this prompt's column list from memory.

    This ticket also depends on RIK-2 for the authenticated (app) route group and its AuthCheck /
    getCurrentUser() pattern (createClient() from lib/supabase/server.ts) — you do not need RIK-2's
    files to exist to write this feature's own code, but app/(app)/importar/page.tsx must be placed
    inside the (app) route group and rely on that guard rather than re-implementing auth checks in
    the page itself. The Server Action itself must still call supabase.auth.getUser() directly (auth
    is enforced server-side, not just by the layout).

    components.json already exists with "style": "base-lyra", "baseColor": "mist" (Base UI variant
    of shadcn, this project migrated off Radix). components/ui/ currently only has button.tsx — you
    will need to add card, input, radio-group (or tabs), progress, alert, table, and badge via the
    shadcn CLI using the project's existing base-lyra registry before building the feature UI.

    package.json has no CSV parsing library installed. Add "papaparse" (dependency) and
    "@types/papaparse" (devDependency) — this is a new dependency, call it out in the deliverables.

    Two things this ticket explicitly does NOT build, per the ticket's own scoping comment: the
    import-history list on /importar (past batches with date/type/result), and the full
    /importar/[batchId] per-row detail table. Both are RIK-5. /importar in this ticket renders ONLY
    the upload form, the type selector, and the inline summary after processing.
  </context>

  <ground_truth_db_notes critical="true">
    <note>media_items.imdb_id is the unique join key (constraint media_items_imdb_id_uq); media_items.slug is ALSO unique and not null, but the CSV never provides a slug — you must generate one (e.g. kebab-case(title) + "-" + year, with a retry-on-collision suffix) before any insert.</note>
    <note>media_items.type is not null and application-level only accepts 'movie' | 'tv' (no DB check constraint enforces this, but every other query assumes it). The CSV's raw "Title Type" column (movie, tvSeries, tvMiniSeries, short, tvMovie) must be mapped locally — do not persist the raw CSV value into `type`, only into `title_type`.</note>
    <note>user_media_status has a UNIQUE (user_id, media_id) constraint — implement the write as a single upsert (insert ... on conflict (user_id, media_id) do update ...) rather than select-then-insert, both to avoid races and because the manually_edited guard is naturally expressed as an ON CONFLICT ... WHERE clause or an application-level branch inside the same transaction.</note>
    <note>user_media_status.manually_edited is READ-ONLY for this ticket. It defaults false and this ticket never sets it true — it exists so a future manual-edit feature (not this ticket) can protect a user's in-app changes from being clobbered by a reimport. Your job here is only to check it before overwriting watched/personal_rating/want_to_watch/want_added_at.</note>
    <note>imdb_import_rows.result ('matched' | 'created' | 'skipped') reflects ONLY the media_items match/create/invalid-row outcome. It is independent of whether the user_media_status write was skipped due to manually_edited = true — a row can legitimately be result = 'matched' or 'created' even when its user_media_status upsert was skipped for that reason. Do not conflate the two, and do not invent a fourth result value for "matched but protected".</note>
    <note>imdb_import_batches.status is a plain varchar with default 'pending' and no enum constraint in the schema doc. Since this ticket processes synchronously inside the Server Action's request/response (no background job), set it directly to 'completed' once the row loop finishes, or 'failed' only for an unrecoverable error (e.g. the file could not be parsed at all). Do not persist an interim 'processing' state — there is no polling UI in this ticket to observe it.</note>
    <note>RLS for user_media_status, imdb_import_batches, and imdb_import_rows is strictly owner-only (auth.uid() = user_id, the Section 9.1 "owner_all" pattern). This is a user-facing flow: every service call must be instantiated with the request-scoped client from lib/supabase/server.ts (which carries the user's session and is subject to RLS). NEVER import lib/supabase/admin.ts anywhere in actions/imdb-import, services/ImdbImportServices, or ingestion/imdb-import — that client is reserved exclusively for ingestion/catalog/ (see ARCHITECTURE.md). Never accept a user_id from client input; derive it only from supabase.auth.getUser().</note>
    <note>media_items, genres, people (and their join tables media_genres, media_people) are catalog tables whose RLS write access is generically described as "admin / ingestion process only" — but Section 7.3 of this same schema doc requires a USER-triggered import to create stub media_items (and, per the Section 7.2 mapping, genres/people rows for Genres/Directors). Before writing any insert against these tables, confirm in the REAL landed RIK-1 migration whether an authenticated-role INSERT policy already exists for this purpose (e.g. scoped as `with check (is_stub = true)` on media_items). If it does not exist, add ONE minimal, policy-only migration (no table or column changes) granting it — do not work around the gap by importing admin.ts, and do not silently skip stub creation. Report clearly in the completion report which branch was taken (policy already existed / policy added / could not resolve).</note>
    <note>The Directors CSV column gives director names only, with no IMDb nconst — match/create rows in `people` by trimmed name (case-insensitive match on `name`), leaving `people.imdb_id` null. Do not attempt to invent an nconst.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="0. Verify landed schema and RLS">
      <item>Read the actual latest migration(s) in supabase/migrations/. Confirm every column referenced in this prompt (see ground_truth_db_notes) matches exactly — name, type, default, constraint.</item>
      <item>Confirm whether an authenticated INSERT policy exists on media_items/genres/media_genres/people/media_people for stub creation. If missing, write ONE new timestamped migration adding the minimal policy (no schema changes) before proceeding.</item>
    </phase>

    <phase title="1. Types">
      <item>Add to types/index.ts (or the appropriate types/ file re-exported from the barrel): ImdbImportBatch, ImdbImportRow, and an ImdbCsvSourceType = 'ratings' | 'watchlist' union. Match the real DB columns from Phase 0, including nullability.</item>
      <item>Reuse the existing MediaItem and UserMediaStatus types from RIK-1/RIK-2's work if already present; do not redefine them.</item>
    </phase>

    <phase title="2. Constants and utilities">
      <item>constants/imdbTitleTypeMap.ts — export a map/function from raw IMDb title_type values (movie, tvMovie, tvSeries, tvMiniSeries, short) to 'movie' | 'tv', per the mapping in ground_truth_db_notes. Default unmapped/unknown values to 'movie' with a code comment explaining why (fail open, not closed, so an unrecognized value doesn't abort the whole row).</item>
      <item>lib/slug.ts — export a slugify(title: string, year?: number) helper producing a URL-safe kebab-case slug, plus a helper/pattern for retrying with a disambiguating suffix on a unique_violation from Postgres (do not pre-query for uniqueness — rely on the DB constraint and retry).</item>
    </phase>

    <phase title="3. Ingestion (ingestion/imdb-import/)">
      <item>parseCsv.ts — wrap papaparse to parse the uploaded CSV text into typed rows, with header validation. A row is invalid (do not process further, do not write any DB row for it, record result='skipped') when Const is empty/missing OR Title is empty/missing.</item>
      <item>processRow.ts (or split by source type) — implement Section 7.3 exactly:
        - Ratings: find-or-create media_items by imdb_id (result matched/created), then upsert user_media_status with watched=true, watched_at=Date Rated, personal_rating=Your Rating, source='imdb_ratings', respecting manually_edited (see Phase 4).
        - Watchlist: same find-or-create step, then upsert user_media_status with want_to_watch=true, want_added_at (from a CSV date column if present, else now()), source='imdb_watchlist', never touching watched.
      </item>
      <item>All DB access in this layer goes through services/ImdbImportServices, not raw Supabase calls inline — keep query shapes centralized per ARCHITECTURE.md's services convention.</item>
      <item>This routine receives the RLS-scoped Supabase client and the authenticated user's id as parameters — it never creates its own client and never imports admin.ts.</item>
    </phase>

    <phase title="4. Services (services/ImdbImportServices)">
      <item>createBatch(userId, sourceType, fileName) → inserts imdb_import_batches, status='pending', returns the batch row.</item>
      <item>findOrCreateMediaItem(client, csvRow) → select by imdb_id; if missing, insert with is_stub=true using the mapped type, generated slug, and the CSV's title/year/imdb_rating/imdb_votes/runtime_minutes; also link Genres/Directors (find-or-create genres by slug, people by trimmed name) into media_genres/media_people. Returns { mediaItem, result: 'matched' | 'created' }.</item>
      <item>upsertUserMediaStatus(client, userId, mediaId, patch, isRatingsImport) → upsert on (user_id, media_id). Before applying watched/watched_at/personal_rating (ratings) or want_to_watch/want_added_at (watchlist), check the existing row's manually_edited: if true, skip those fields entirely EXCEPT when isRatingsImport and the existing personal_rating is null and the CSV provides one — in that case update personal_rating only, leave manually_edited untouched (still true), and do not touch watched/watched_at/source.</item>
      <item>insertRow(batchId, csvRow, mediaId | null, result) → inserts imdb_import_rows.</item>
      <item>finalizeBatch(batchId, counts) → updates imdb_import_batches total_rows/matched_rows/created_rows/skipped_rows, status='completed' (or 'failed'), completed_at=now().</item>
      <item>Update services/index.ts barrel to export ImdbImportServices.</item>
    </phase>

    <phase title="5. Action (actions/imdb-import)">
      <item>importImdbCsv(prevState, formData): 'use server' function compatible with useActionState — reads the file (File) and sourceType ('ratings' | 'watchlist') from formData, calls supabase.auth.getUser() and rejects if unauthenticated, reads the file's text, delegates to the ingestion routine with the RLS-scoped client and the user's id, and returns a summary object { batchId, totalRows, matchedRows, createdRows, skippedRows, sourceType } (or an error shape) for the client to render inline.</item>
      <item>After a successful run, call revalidatePath for the screens that read user_media_status (e.g. /panel, /biblioteca, /recomendaciones) — do NOT revalidate an /importar history list, since it doesn't exist in this ticket's scope.</item>
      <item>Update actions/index.ts barrel if one exists.</item>
    </phase>

    <phase title="6. Features (features/import/)">
      <item>UploadForm.tsx — client component using useActionState with importImdbCsv; renders the source-type selector (RadioGroup or Tabs — Calificaciones / Lista de seguimiento), a file input restricted to .csv, and a submit button disabled while pending (per the useActionState `pending` boolean from forms.md).</item>
      <item>ImportSummary.tsx — renders the returned state (Alert with total/matched/created/skipped counts) inline in the same page, no navigation. Handle the error shape from the action (e.g. unparseable file) with a destructive Alert variant.</item>
    </phase>

    <phase title="7. Components (shadcn base-lyra)">
      <item>Add the missing primitives via the shadcn CLI using this project's existing base-lyra registry config in components.json: card, input, radio-group (or tabs — pick one and use it consistently with the vistas-y-estilo doc's suggestion), progress, alert, table, badge.</item>
    </phase>

    <phase title="8. Route (app/(app)/importar/page.tsx)">
      <item>Server Component shell inside the (app) route group. Renders <UploadForm /> (which internally renders <ImportSummary /> once the action resolves). No batch-history table, no link to a [batchId] route (RIK-5).</item>
    </phase>

    <phase title="9. Config and dependencies">
      <item>next.config.ts — add experimental.serverActions.bodySizeLimit (e.g. '4mb') since IMDb ratings histories can exceed the 1MB default cap.</item>
      <item>package.json — add papaparse and @types/papaparse.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Uploading a Ratings CSV sets watched=true, personal_rating, and watched_at on rows matching an existing imdb_id, and creates a media_items stub (is_stub=true) for any imdb_id not already in the catalog. Verify: run the action against a fixture CSV with one pre-existing imdb_id and one new imdb_id; `select watched, personal_rating, watched_at from user_media_status ums join media_items mi on mi.id = ums.media_id where mi.imdb_id = '&lt;fixture&gt;'` returns the expected values; confirm the new imdb_id now exists in media_items with is_stub = true.</criterion>
    <criterion id="AC-2">Uploading a Watchlist CSV sets want_to_watch=true and want_added_at, and does not modify watched on a title already marked watched. Verify: seed a user_media_status row with watched=true for an imdb_id also present in the watchlist fixture; after import, watched remains true and want_to_watch becomes true for that row.</criterion>
    <criterion id="AC-3">The Server Action's response renders an inline summary (total, matched, created, skipped) in the same request without a full page navigation or reload. Verify: after submit, ImportSummary renders from the useActionState-returned state; no router.refresh() or full GET to /importar follows the action's POST.</criterion>
    <criterion id="AC-4">A user_media_status row with manually_edited=true is not overwritten by reimport, except that personal_rating may be filled when it was previously NULL. Verify: seed a row with manually_edited=true, watched=true, personal_rating=NULL; reimport a ratings CSV with a different rating for that imdb_id — personal_rating becomes the CSV value, watched/watched_at remain the seeded values, manually_edited stays true. Seed a second row with personal_rating already set; reimport with a different rating — personal_rating is unchanged.</criterion>
    <criterion id="AC-5">A CSV with invalid rows (missing required columns, empty Const) marks only those rows as result='skipped' in imdb_import_rows, without aborting the rest of the file. Verify: fixture CSV with 3 valid rows and 1 row with an empty Const; after import, imdb_import_batches.total_rows=4 and skipped_rows=1, and `select result from imdb_import_rows where batch_id = '&lt;batch&gt;'` shows the other 3 as matched/created and 1 as skipped.</criterion>
    <criterion id="AC-6">All writes are scoped to the authenticated user via RLS; no service-role client is used anywhere in this feature. Verify: code review confirms actions/imdb-import, services/ImdbImportServices, and ingestion/imdb-import never import lib/supabase/admin.ts; an attempted write with a mismatched user_id is rejected by Postgres RLS, not merely filtered by application code.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT import lib/supabase/admin.ts anywhere in this feature's code (actions/imdb-import, services/ImdbImportServices, ingestion/imdb-import) — it is reserved for ingestion/catalog/ only, per ARCHITECTURE.md and the ticket's own team comment.</item>
    <item>Do NOT create a new supabase migration EXCEPT the minimal policy-only migration described in ground_truth_db_notes if the stub-creation INSERT policy is genuinely missing — no table or column changes belong to this ticket, RIK-1 owns the schema.</item>
    <item>Do NOT rename or repurpose any existing column (imdb_id, personal_rating, watched_at, want_to_watch, want_added_at, manually_edited, result, is_stub, etc.) — reuse them verbatim as documented.</item>
    <item>Do NOT auto-unmark want_to_watch for titles missing from a re-imported Watchlist CSV — the schema doc explicitly recommends against this (option (b) in Section 7.3); only reporting such cases is in scope, and reporting itself is RIK-5.</item>
    <item>Do NOT build the /importar/[batchId] detail view or an import-history list/table on /importar — both are RIK-5. /importar in this ticket renders only the upload form, type selector, and inline summary.</item>
    <item>manually_edited=true rows: never overwrite watched, watched_at, personal_rating, want_to_watch, or want_added_at, EXCEPT personal_rating may be filled if it is currently NULL and the CSV provides a Your Rating value (ratings import only).</item>
    <item>CSV parsing happens server-side, inside the Server Action — do not parse on the client and send pre-parsed JSON, since validation and row counts must be single-sourced server-side.</item>
    <item>Never accept a user_id, batch_id, or media_id as trusted client input for a write — derive the user from the session and derive batch/media ids from the server-side flow.</item>
  </constraints>

  <out_of_scope>
    <item>/importar/[batchId] full per-row detail table — RIK-5.</item>
    <item>Import-history list on /importar (past batches with date/type/result) — RIK-5.</item>
    <item>Stub enrichment (poster, synopsis, cast) for is_stub=true titles — a separate future process.</item>
    <item>Auto-unmark reconciliation for watchlist "bajas" — deliberately not implemented.</item>
    <item>Background/queued processing — this ticket is synchronous within the Server Action's request/response only.</item>
    <item>Any UI outside /importar — other screens are only revalidated, never modified.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Prefer a single SQL upsert (insert ... on conflict (user_id, media_id) do update ... ) for user_media_status where practical, with the manually_edited branch expressed either in a WHERE clause on the DO UPDATE or as an application-level read-then-conditional-write inside the same service method — either is acceptable as long as it's centralized in one function (upsertUserMediaStatus) rather than duplicated between the ratings and watchlist paths.</item>
    <item>Keep parseCsv.ts's row type CSV-shaped (raw strings) and let processRow.ts do type coercion (Year → integer, Your Rating → smallint, Date Rated → Date), so validation and coercion errors are attributable to a specific row instead of failing the whole parse.</item>
    <item>File size / row count: no hard cap is specified by the ticket; rely on the Server Action body size limit (Phase 9) as the practical ceiling rather than inventing an arbitrary row-count limit.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases above, created or modified.</item>
    <item>Run npm run lint and fix any issues introduced by this change.</item>
    <item>Run npm run build (or at minimum a TypeScript check) to confirm the new Server Action, services, and types compile cleanly.</item>
    <item>Persist documentation per completion_report/persistence below: one CHANGELOG.md bullet under [Unreleased], and one specs/logs/ file.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether RIK-1's landed migration already grants authenticated users an INSERT policy on media_items/genres/media_genres/people/media_people for stub creation. Default if unconfirmed: verify against the real migration first; if missing, add one minimal policy-only migration rather than blocking or using admin.ts, and state clearly in the completion report which branch was taken.</item>
    <item>Whether genre/director linking (Decision 4) should be in scope at all, since it's not explicitly named in the ticket's acceptance criteria even though Section 7.2 maps those columns. Default if unconfirmed: implement it as described in Phase 3/4 — it's a small addition once findOrCreateMediaItem exists, and skipping it would leave stub items more incomplete than the CSV data allows.</item>
    <item>Whether to use RadioGroup or Tabs for the source-type selector (both are valid per the vistas-y-estilo doc's "RadioGroup o Tabs" wording). Default if unconfirmed: RadioGroup, since the two options are mutually exclusive and not really separate views.</item>
    <item>Whether want_added_at should read a CSV "Created" column when present. Default if unconfirmed: use it when present, otherwise now() at import time.</item>
  </clarify_before_coding>

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
        <item>Format: `- RIK-4: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-4_imdb_import.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-4_imdb_import.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / constants / lib / ingestion / services / actions / features / components / routes / config), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-4 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; optional "Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the import upload page" instead of naming the component, "your watched history" instead of naming columns, "your watchlist" instead of want_to_watch.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Include a "## Screenshots" section (this ticket has user-visible UI) listing 1–4 captures to attach, each with: screen/area name, auth state, and what it should show — e.g. "Import page — logged in: upload form with Calificaciones/Lista de seguimiento selector before uploading a file", "Import page — after upload: summary showing total/matched/created/skipped counts". Prefix each with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is Mixed UI + Logic — include "## Prerequisites" (dev server running, a logged-in test user, two small fixture CSVs: one Ratings export, one Watchlist export, each with at least one row matching an existing catalog title and one new imdb_id, plus one row with an empty Const to test the skip path), then "## UI validation" (numbered steps at /importar: select Calificaciones, upload the ratings fixture, confirm the inline summary shows the expected total/matched/created/skipped without a page reload; repeat with Lista de seguimiento), then "## Logic validation" (how to inspect the resulting rows — SQL against user_media_status, media_items, imdb_import_batches, imdb_import_rows to confirm watched/want_to_watch flags, stub creation, and the manually_edited protection), then "## Expected outcome" (bullets tying back to AC-1 through AC-6).</item>
      <item>SQL must be read-only verification queries — no INSERT/UPDATE/DELETE, except the one explicit step (if included) instructing the human to manually set manually_edited=true on a seeded row before re-running the import, which is inherent to testing AC-4 and should be called out clearly as a setup step, not a hidden side effect.</item>
      <item>Use the real route /importar.</item>
    </deliverable>
  </completion_report>
</task>
```

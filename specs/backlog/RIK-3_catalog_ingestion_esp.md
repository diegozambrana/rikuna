# RIK-3 — Ingesta del catálogo de disponibilidad

> Documento en español. La fuente de verdad es `specs/backlog/RIK-3_catalog_ingestion.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

Una rutina server-only que convierte los archivos periódicos por plataforma/país del proceso externo en filas reales de `media_availability`, para que el resto de la app (panel, recomendaciones, ficha de título) pueda confiar en "esto está disponible ahora mismo" en vez de una lista estática desactualizada. Cada carga de archivo crea una fila en `catalog_snapshots`, hace upsert de un `media_items` stub para lo que no exista aún en el catálogo, hace upsert de `media_availability` como disponible, y luego expira (nunca borra) todo lo que salió del último snapshot de esa plataforma+país.

- Cargar un archivo de ejemplo para una plataforma/país crea su fila en `catalog_snapshots` y puebla `media_availability` con `last_seen_at` / `last_snapshot_id` correctos.
- Un título presente en el snapshot anterior pero ausente en el nuevo queda con `is_available = false`, fila preservada (no borrada).
- Cargar el mismo archivo dos veces es idempotente — sin filas duplicadas en `media_availability`, garantizado por el `unique (media_id, platform_id, country, offer_type)` ya existente.
- La rutina debe poder ejecutarse de forma repetible (script/comando) sin intervención manual en base de datos.
- Sin UI, sin rutas `app/`, sin slice en `features/` — esto es exclusivamente una rutina de backend.

Este ticket depende de **RIK-1** (esquema + RLS, aún no aplicado al momento de especificar — ver `Decisiones tomadas`). El formato del JSON crudo del proceso externo no está documentado en `specs/`; este documento infiere un valor por defecto razonable y lo marca como la pregunta abierta principal.

---

## Contexto

### Ticket original

**RIK-3 — Ingesta del catálogo de disponibilidad**

**Descripción:** Rutina en `ingestion/` (server-only, cliente admin de Supabase) que procesa los archivos por plataforma/país del proceso externo: crea un `catalog_snapshots`, hace upsert de cada título en `media_items` (creando stub si no existe) y en `media_availability` (`is_available = true`, `last_snapshot_id`), y al final marca `is_available = false` en todo lo que quedó fuera del snapshot recién procesado, según la lógica de la Sección 3.3 del esquema.

**Criterios de aceptación:**
- Cargar un archivo de ejemplo de una plataforma/país crea el `catalog_snapshots` correspondiente y puebla `media_availability` con `last_seen_at`/`last_snapshot_id` correctos.
- Un título que existía en el snapshot anterior pero no en el nuevo queda con `is_available = false` tras la carga, sin borrarse la fila.
- Cargar el mismo archivo dos veces es idempotente: no se duplican filas de `media_availability` (respeta el `unique (media_id, platform_id, country, offer_type)`).
- La rutina puede correrse de forma repetible (script o comando) sin intervención manual en base de datos.

**Nota:** Este ticket apunta a tablas (`catalog_snapshots`, `media_availability`, `media_items`, `platforms`) que hoy solo existen en el papel — `supabase/migrations/` aún no existe en el repositorio. Todo lo que sigue asume que **RIK-1** ya está aplicado al momento de implementar este ticket; el agente de código debe reverificar nombres/tipos/defaults de columnas contra la migración real antes de escribir cualquier query (ver `Decisiones tomadas` #1 y `<ground_truth_db_notes>` en el prompt).

### Comentarios del equipo

No existen comentarios de equipo para este ticket — se pegó directamente del tracker con descripción y criterios de aceptación únicamente. Según la lista de tickets hermanos entregada en esta corrida, la cadena de dependencias es: RIK-3 depende de RIK-1; RIK-4/5/6/7/8/9 dependen (directa o transitivamente) de RIK-3 para tener datos reales de disponibilidad. Ningún comentario redirige el alcance; la descripción es la fuente autoritativa completa.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| "crea un `catalog_snapshots`... upsert en `media_items`... `media_availability`" | Ninguna de estas tablas existe todavía — el directorio `supabase/` no existe en absoluto (confirmado: `ls supabase` falla). | Dependencia dura de que RIK-1 se aplique primero. Este ticket no puede ejecutarse (solo especificarse) hasta que la migración de RIK-1 exista. |
| "cliente admin de Supabase" | `lib/supabase/admin.ts` no existe todavía. Según `ARCHITECTURE.md`, lo introduce **RIK-2**, pero RIK-3 es su primer consumidor real. `@supabase/supabase-js` / `@supabase/ssr` tampoco están en `package.json` todavía. | El implementador debe verificar si RIK-2 ya agregó `admin.ts` antes de crearlo, para evitar un archivo duplicado/conflictivo. |
| "según la lógica de la Sección 3.3 del esquema" | La Sección 3.3 existe verbatim en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (líneas 145–184), incluyendo el SQL literal de expiración. | No hace falta re-derivarla — el prompt apunta al agente directamente ahí. |
| El ticket no da un formato de archivo para el JSON del proceso externo | No está documentado en ningún lugar de `specs/`. Solo existen fragmentos inferibles: `platforms.provider_id_movie` / `provider_id_tv` (esquema, líneas 122–123), el comentario de `catalog_snapshots.generated_at` "`metadata.generated_at` del archivo" (línea 135), el ejemplo de `catalog_snapshots.source_file` `"apple-tv-plus_BO.json"` (línea 136), y la descripción de `constants/platforms.ts` en `ARCHITECTURE.md` ("used when mapping incoming catalog files to platforms rows"). | Esta es la mayor pregunta abierta del ticket. Se resuelve como un default no bloqueante más abajo (ver `Decisiones tomadas` #2–#4), ya que no se entregaron archivos de ejemplo reales en esta corrida. |
| El ticket implica una rutina que "simplemente corre" | La carpeta `ingestion/` no existe; no hay runner de scripts (`tsx`/`ts-node`) configurado en `package.json`; no existe ningún punto de entrada `npm run` para nada con forma de ingesta. | Este ticket también debe montar el mecanismo mínimo de ejecución de scripts (criterio "puede correrse de forma repetible... sin intervención manual"), no solo la lógica de ingesta en sí. |

### Estado actual en la base de datos

Ninguna tabla existe todavía (`supabase/migrations/` ausente). Las tablas que este ticket escribe están definidas solo en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`, Secciones 2.1, 3.1–3.3 (verbatim abajo, para que el agente de código no tenga que re-derivarlas — pero **debe** reverificarlas contra la migración real de RIK-1 una vez exista, ya que una migración puede desviarse del documento de PRD durante la propia implementación de RIK-1):

```sql
-- media_items (Sección 2.1) — columnas relevantes para este ticket
imdb_id         varchar not null,          -- unique
type            varchar not null,          -- 'movie' | 'tv'
title_type      varchar,
title           varchar not null,
slug            varchar not null,          -- unique, sin regla de generación documentada en ningún lado
year            integer,
is_stub         boolean default false not null,
metadata        jsonb default '{}'::jsonb not null,
constraint media_items_imdb_id_uq unique (imdb_id),
constraint media_items_slug_uq unique (slug)

-- platforms (Sección 3.1)
id                uuid,
name              varchar not null,
slug              varchar not null unique,   -- "apple-tv-plus"
provider_id_movie integer,
provider_id_tv    integer

-- catalog_snapshots (Sección 3.2)
id           uuid,
platform_id  uuid not null references platforms(id),
country      varchar(2) not null,
generated_at timestamptz not null,          -- metadata.generated_at del archivo
source_file  varchar,                       -- "apple-tv-plus_BO.json"
total_items  integer default 0 not null,
status       varchar default 'pending' not null  -- 'pending' | 'completed' | 'failed'

-- media_availability (Sección 3.3)
id               uuid,
media_id         uuid not null references media_items(id),
platform_id      uuid not null references platforms(id),
country          varchar(2) not null,
url              text,
offer_type       varchar default 'subscription' not null,  -- 'subscription' | 'rent' | 'buy'
is_available     boolean default true not null,
first_seen_at    timestamptz default now() not null,
last_seen_at     timestamptz default now() not null,
last_snapshot_id uuid references catalog_snapshots(id),
constraint media_availability_uq unique (media_id, platform_id, country, offer_type)
```

RLS (Sección 9): `media_items`, `platforms`, `media_availability`, `catalog_snapshots` son de lectura pública, **escritura solo por service-role** — precisamente por eso esta rutina debe correr a través de `lib/supabase/admin.ts` y nunca con un cliente de sesión de usuario.

**Uso en código:** ninguno todavía — no existen `services/` ni el barrel de `types/`. Este ticket es lo primero que lee/escribe estas cuatro tablas desde código de aplicación.

### Lógica actual (ingestion)

`ingestion/` no existe. `ARCHITECTURE.md` (líneas 124–131) describe la forma prevista pero no hay implementación:

> "**Availability snapshots** (`ingestion/catalog/`) — consumes the periodic JSON produced by the external platform+country process. Creates a `catalog_snapshots` row, upserts `media_items` (by `imdb_id`) and `media_availability`, then expires anything not seen in that snapshot. Runs on a schedule, using the `admin.ts` service-role client (no end-user session involved)."

El paso exacto de upsert + expiración está dado verbatim en el documento de esquema, `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` líneas 170–184:

```
1. Se crea un catalog_snapshots con los datos de metadata del archivo.
2. Por cada título del catálogo crudo: upsert en media_items por imdb_id, y upsert en
   media_availability con is_available = true, last_seen_at = generated_at y
   last_snapshot_id = <snapshot actual>.
3. Al terminar, todo lo que en esa plataforma+país tenga un last_snapshot_id distinto
   al snapshot recién procesado se marca is_available = false.
```

```sql
-- Paso 3: marcar como no disponible lo que ya no apareció
update public.media_availability
set is_available = false
where platform_id = :platform_id
  and country     = :country
  and (last_snapshot_id is distinct from :snapshot_id)
  and is_available;
```

Nota sobre la semántica `is distinct from`: esto también expira filas con `last_snapshot_id` en `null` (no debería ocurrir después de este ticket, pero cualquier traducción a Supabase-JS de este filtro debe preservar ese comportamiento, no solo `neq`, que en Postgres excluye silenciosamente las filas `null`).

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Fila de `catalog_snapshots` por carga de archivo | tabla | Definida en el esquema, Sección 3.2, aún no migrada | Reusar una vez aplicado RIK-1 — no agregar columnas |
| Upsert de `media_items` por `imdb_id`, stub si falta | tabla + flag `is_stub` | Definida en el esquema, Sección 2.1 | Reusar; la creación de stubs replica el patrón ya documentado para la importación de IMDb (Sección 7.3) |
| Upsert de `media_availability`, `is_available=true`, `last_snapshot_id` | tabla | Definida en el esquema, Sección 3.3 | Reusar verbatim; la clave de upsert es el `unique (media_id, platform_id, country, offer_type)` ya existente |
| Paso de expiración al final de la carga | SQL | Dado verbatim en la Sección 3.3 | Reusar verbatim (o un filtro equivalente en Supabase-JS que preserve la semántica `is distinct from`) |
| Identidad "plataforma/país" del archivo crudo | no especificado por el ticket | Ejemplo `catalog_snapshots.source_file` `"apple-tv-plus_BO.json"`, `platforms.slug` | **Debe crearse**: una convención de nombre de archivo (`<platform-slug>_<COUNTRY>.json`) más una búsqueda/creación contra `platforms.slug` |
| Forma del item del archivo crudo (`imdb_id`, `title`, `year`, `url`, `offer_type`) | no especificado por el ticket | Nada existente | **Debe crearse**: contrato JSON inferido, documentado en `ingestion/catalog/types.ts`, marcado como suposición |
| Generación de `media_items.slug` para stubs | no especificado por el ticket ni por el esquema | Nada existente | **Debe crearse**: helper compartido de slug (kebab-case título + año, resistente a colisiones) |

### Archivos impactados

**ingestion** (nuevo)
- `ingestion/catalog/types.ts` — contrato TypeScript del archivo/item crudo (la forma de entrada inferida)
- `ingestion/catalog/parseCatalogFile.ts` — lee + valida un archivo JSON contra el contrato
- `ingestion/catalog/resolvePlatform.ts` — deriva `{ slug, country }` del nombre de archivo, busca/crea la fila en `platforms`
- `ingestion/catalog/run.ts` — orquestador que implementa el algoritmo de 3 pasos + punto de entrada CLI
- `ingestion/catalog/__fixtures__/*.json` — archivos de ejemplo para ejercitar manualmente los cuatro criterios de aceptación (ver `manual_validation`)

**lib** (nuevo, salvo que RIK-2 ya haya entregado `admin.ts`)
- `lib/supabase/admin.ts` — cliente de Supabase con service-role, server-only
- `lib/slug.ts` — generador de slug compartido (kebab-case + sufijo anti-colisión), reusable por RIK-4 más adelante

**constants** (nuevo)
- `constants/platforms.ts` — mapa de slug de plataforma conocida → nombre / provider id, usado como fuente semilla cuando `resolvePlatform` necesita crear una fila de `platforms` faltante

**types** (nuevo, o extendido si un ticket hermano ya creó el barrel)
- `types/MediaItem.ts`, `types/Platform.ts`, `types/CatalogSnapshot.ts`, `types/MediaAvailability.ts`
- `types/index.ts` — barrel export

**services** (nuevo, o extendido)
- `services/CatalogSnapshotServices/index.ts` — crea la fila de snapshot, la marca completed/failed
- `services/MediaServices/index.ts` — upsert-o-crea-stub por `imdb_id`
- `services/MediaAvailabilityServices/index.ts` — upsert de disponibilidad, expiración de filas obsoletas
- `services/index.ts` — barrel export

**config**
- `package.json` — agrega `tsx` (devDependency), agrega `@supabase/supabase-js` (si RIK-2 no lo hizo ya), agrega el script `"ingest:catalog"`

**docs (siempre, según el flujo de trabajo)**
- `CHANGELOG.md` — un bullet bajo `[Unreleased]`
- `specs/logs/<timestamp>_RIK-3_catalog_ingestion.md` — bitácora de trabajo

### Decisiones tomadas

1. **Dependencia de RIK-1 tratada como ya aplicada al momento de ejecutar.** Este documento está escrito contra el DDL de las Secciones 2.1/3.1–3.3 del esquema como verdad actual. Default recomendado: proceder con esta especificación ahora; el agente de código reverifica la migración real antes de escribir queries. *No confirmado — depende de la implementación real de RIK-1.*
2. **Forma del archivo crudo (inferida).** Un sobre JSON por archivo de plataforma+país: `{ "metadata": { "generated_at": "<ISO8601>" }, "items": [ { "imdb_id": "tt...", "title": "...", "year": 2024, "url"?: "...", "offer_type"?: "subscription"|"rent"|"buy", "type"?: "movie"|"tv" } ] }`. Default recomendado, ya que no se entregó un archivo de ejemplo real con este ticket. *No confirmado — debe validarse contra el archivo real del proceso externo antes de la primera carga real.*
3. **La identidad plataforma + país viene del nombre de archivo**, no del cuerpo JSON: `<platform-slug>_<COUNTRY>.json` (coincide con el propio ejemplo de `source_file` del esquema, `"apple-tv-plus_BO.json"`). Default recomendado — mantiene el contrato mínimo y coincide con el único ejemplo concreto que da el PRD. *No confirmado.*
4. **El `type` faltante por item por defecto es `'movie'`.** Según la Sección 11 ítem 1 del esquema / Sección 13 del documento de producto, el proceso externo real hoy solo entrega de forma confiable un catálogo completo de **películas**; la cobertura de series es un gap conocido y rastreado por separado. Default recomendado para que la rutina no falle duro con los archivos reales de hoy. *No confirmado, y explícitamente no es una solución al gap de series — ver Fuera de alcance.*
5. **Generación de `media_items.slug`**: kebab-case(`title`) + `-` + `year` (cuando existe), con un sufijo corto derivado de `imdb_id` agregado solo ante una colisión de unicidad. Implementado una sola vez como `lib/slug.ts` ya que RIK-4 (importación de IMDb) enfrentará exactamente el mismo vacío no resuelto. Default recomendado — no existe ningún algoritmo documentado en `specs/`. *No confirmado.*
6. **La fila de `platforms` es de tipo find-or-create, no se asume pre-sembrada.** El texto del ticket de RIK-1 no menciona sembrar `platforms` con filas reales (Netflix, Apple TV+, etc.), así que esta rutina busca por `slug` y crea la fila desde `constants/platforms.ts` si falta, en vez de fallar ante una plataforma nueva. Default recomendado. *No confirmado.*
7. **Runner de scripts**: agregar `tsx` como devDependency y un script npm `"ingest:catalog": "tsx ingestion/catalog/run.ts"`, invocado como `npm run ingest:catalog -- --file <path>`, para satisfacer "repetible, sin intervención manual en BD" sin inventar una ruta API de Next.js para algo explícitamente documentado como fuera del ciclo de petición/respuesta. Default recomendado. *No confirmado.*
8. **No se agrega framework de tests automatizados.** El proyecto no tiene `vitest`/`jest` configurado. La verificación de este ticket se apoya en archivos de fixture + SQL manual (ver `manual_validation`), no en una suite de tests nueva. Default recomendado, consistente con la guía de `analyze-ticket.md` ("si no existe una suite de tests todavía, anotarlo"). *No confirmado.*

### Fuera de alcance

- **Completitud del catálogo de series** — el proceso externo hoy solo entrega listas derivadas para series, no un catálogo completo (esquema, Sección 11 ítem 1; documento de producto, Sección 13). Este ticket no soluciona ese gap upstream; solo evita fallar duro ante él mediante el default de `type` en la Decisión 4.
- **Enriquecimiento de stubs** (poster, sinopsis, elenco para títulos `is_stub = true`) — proceso futuro separado (esquema, Sección 11 ítem 3).
- **Programación/automatización** de la ejecución de la rutina (cron, Vercel Cron, GitHub Action) — este ticket solo entrega un script ejecutable de forma repetible bajo demanda; conectarlo a un horario es un tema aparte.
- **Resolución de enlaces profundos** más allá del `url` que ya provea el archivo crudo (esquema, Sección 11 ítem 2).
- **Lógica de diferenciación de `offer_type`** más allá de pasar lo que provea el archivo / apoyarse en el default de columna (esquema, Sección 11 ítem 5, aún marcada como pendiente en el PRD).
- **Cualquier UI o ruta `app/`** para disparar o monitorear ejecuciones — el ticket es explícito en que esto no es UI.
- **Agregar un framework de tests general** (vitest/jest) al repositorio — tema aparte.
- **UI de historial de ejecuciones estilo `/importar/[batchId]`** — ese patrón es para `imdb_import_batches` (RIK-4/RIK-5), no para el `catalog_snapshots` de este ticket.

---

## Plan de implementación

**Objetivo:** levantar `ingestion/catalog/` como una rutina repetible, exclusiva de service-role, que convierta un archivo JSON del proceso externo en filas de snapshot + disponibilidad según el algoritmo exacto de la Sección 3.3 del esquema, sentando las bases de tipos/servicios (`lib/supabase/admin.ts`, `types/`, `services/`) que RIK-4 a RIK-9 también necesitarán.

**Alcance incluido:**
1. `lib/supabase/admin.ts` — cliente service-role (omitir si RIK-2 ya lo agregó; verificar primero).
2. `constants/platforms.ts` — mapa de slug/nombre/provider-id de plataformas conocidas.
3. `lib/slug.ts` — generador de slug compartido para `media_items` stub.
4. `types/MediaItem.ts`, `types/Platform.ts`, `types/CatalogSnapshot.ts`, `types/MediaAvailability.ts` + barrel — solo lo que falte.
5. `services/CatalogSnapshotServices`, `services/MediaServices` (upsert-o-stub), `services/MediaAvailabilityServices` (upsert + expiración, preservando la semántica exacta de la Sección 3.3).
6. `ingestion/catalog/types.ts`, `parseCatalogFile.ts`, `resolvePlatform.ts`, `run.ts` implementando el algoritmo de 3 pasos de punta a punta.
7. Archivos de fixture de ejemplo (`__fixtures__/`) cubriendo: una primera carga, una segunda carga del mismo archivo (idempotencia), y una segunda carga con un título removido (expiración).
8. `package.json`: devDependency `tsx`, script `"ingest:catalog"`.

**Fuera de alcance:** ver arriba — completitud de series, enriquecimiento de stubs, programación, enlaces profundos, política de offer_type, UI, framework de tests.

**Riesgos clave / compatibilidad:**
- Escribir en `media_items` / `platforms` / `catalog_snapshots` / `media_availability` **debe** pasar por `lib/supabase/admin.ts` — estas tablas son de escritura exclusiva por service-role bajo RLS (esquema, Sección 9). Cualquier uso accidental del cliente anon/de sesión fallará silenciosamente todas las escrituras una vez que RLS esté habilitado.
- La semántica `is distinct from` del paso de expiración debe sobrevivir la traducción a Supabase-JS (o ejecutarse como SQL crudo) — un filtro `.neq()` ingenuo omitiría incorrectamente filas con `last_snapshot_id` en `null`.
- `media_items.slug` y `type` son `not null` sin regla de derivación documentada; el camino de creación de stubs nunca debe violar esas restricciones, o el item entero se descarta silenciosamente en vez de ingerirse.
- Nada en este ticket debe editar una migración existente — si la migración real de RIK-1 carece de algo que este documento asumió, eso es motivo de detenerse y reportarlo, no de editar el esquema.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | `run.ts` crea primero la fila de `catalog_snapshots`, luego hace upsert de `media_availability` con `last_seen_at`/`last_snapshot_id` de ese snapshot |
| AC-2 | Paso de expiración (Sección 3.3, paso 3) ejecutado al final de cada carga, delimitado por `platform_id` + `country` |
| AC-3 | Upsert sobre el `media_availability_uq` existente, no insert-y-luego-verificar |
| AC-4 | `npm run ingest:catalog -- --file <path>` vía el nuevo script `tsx`, sin SQL manual entre corridas |
| AC-5 | El camino upsert-o-stub de `MediaServices` crea filas `is_stub = true` para `imdb_id`s no vistos |
| AC-6 | `CatalogSnapshotServices` fija `status = 'completed'` + `total_items` solo tras el éxito de la corrida completa |

---

## Prompt para Claude Code

```xml
<task id="RIK-3" title="Ingesta del catálogo de disponibilidad" depends_on="RIK-1">
  <role>
    You are a senior full-stack engineer on Rikuna (Next.js 16 App Router + Supabase). This task is a
    server-only ingestion routine, not a UI feature — there is no app/ route and no features/ slice involved.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read the "Catalog Ingestion" section (ingestion/catalog/, lib/supabase/admin.ts boundary), the "Services" and "Types" sections, and the layered/feature-sliced conventions before writing any file.</item>
    <item>AGENTS.md — this project uses a Next.js version with breaking changes vs. your training data. Read the relevant guide under node_modules/next/dist/docs/ (resolved relative to AGENTS.md's own directory) before touching anything Next.js-related. This ticket has minimal Next.js surface (no routes), but read it anyway since it governs the whole repo.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping needed for the commit_message deliverable below.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — read Section 2.1 (media_items), Section 3.1-3.3 (platforms, catalog_snapshots, media_availability, and the exact upsert+expire algorithm with its literal SQL), and Section 11 (open product pendings, notably item 1 on incomplete series coverage). This is the canonical source for every column name/type/default used below.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — Section 13 (Riesgos, Dudas y Decisiones Pendientes) for the same series-catalog-completeness caveat from the product side.</item>
    <item>supabase/migrations/ — read the actual, most recent migration file(s) that create media_items, platforms, catalog_snapshots and media_availability. This spec was written before RIK-1 landed; the applied migration is ground truth if anything differs from the schema doc excerpts in this prompt.</item>
    <item>lib/utils.ts — the only file in lib/ today (shadcn's cn helper); confirms lib/supabase/ does not exist yet unless a prior ticket (RIK-2) already created it — check before creating lib/supabase/admin.ts.</item>
    <item>package.json — confirm current dependencies before adding tsx / @supabase/supabase-js, to avoid duplicating something RIK-1/RIK-2 already added.</item>
    <item>CHANGELOG.md — format and where to append the entry for this ticket.</item>
    <item>specs/logs/README.md — work log filename convention and required template.</item>
  </mandatory_reading>

  <context>
    Rikuna cross-references a user's IMDb history against what is currently available on their active
    streaming subscription. Availability data comes from an external process that periodically produces
    one JSON file per platform+country (e.g. conceptually "apple-tv-plus_BO.json"). This task builds the
    routine that turns one such file into database state: a run-history row in catalog_snapshots, upserted
    media_items (creating incomplete "stub" rows for anything not already in the catalog), and upserted
    media_availability rows marked available — followed by an expire step that flips is_available to false
    for anything that was available before but did not appear in this run's file, WITHOUT deleting the row
    (history must be preserved so future re-appearance is just another upsert).

    This routine is one of exactly two ingestion paths in the app (the other is the user-triggered IMDb CSV
    import under ingestion/imdb-import/, out of scope here). It is explicitly NOT part of the normal
    request/response cycle — it runs as a standalone script using the Supabase service-role client, never
    the per-request session client, because media_items/platforms/catalog_snapshots/media_availability are
    public-read but service-role-write-only under Row Level Security.

    No real sample file shipped with this ticket. The raw JSON contract below is this spec's inferred
    default — treat it as the working assumption, document it clearly in code, and do not block on it.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ does not exist in the repo at spec-writing time — this ticket depends on RIK-1, which creates it. Before writing any query, read the REAL migration file for the true column list/types/defaults on media_items, platforms, catalog_snapshots, media_availability. The DDL quoted in this prompt is copied from specs/RIKUNA-PRD-schema-basedatos-rikuna.md and may have drifted during RIK-1's own implementation.</note>
    <note>media_items.slug is `not null` and `unique` (constraint media_items_slug_uq). No slug-generation algorithm is documented anywhere in specs/. Implement one shared helper (recommended: lib/slug.ts, kebab-case(title) + "-" + year when present, with a short imdb_id-derived suffix appended only on a uniqueness collision) — do not skip slug when creating a stub, the insert will fail the constraint otherwise.</note>
    <note>media_items.type is `not null` ('movie' | 'tv'). The inferred raw file contract makes a per-item type field optional. Default missing/absent type to 'movie': today's real external process reliably supplies a movie catalog but only derived (incomplete) lists for series, per schema doc Section 11 item 1 and product spec Section 13. Do not attempt to "fix" series coverage in this ticket.</note>
    <note>media_availability.offer_type defaults to 'subscription' at the column level (`default 'subscription' not null`) — do not force every ingested item to pass offer_type explicitly; only set it when the raw file actually provides one, and let the DB default apply otherwise.</note>
    <note>catalog_snapshots.status starts 'pending' (`default 'pending' not null`). Only set it to 'completed' after the ENTIRE run (upsert loop + expire step) succeeds; on any unhandled error, leave it as 'pending' or explicitly set 'failed' — never mark 'completed' on a partial run.</note>
    <note>media_availability_uq is `unique (media_id, platform_id, country, offer_type)` — this is the upsert conflict target for step 2 of the algorithm. Do not implement idempotency via a manual "select then insert/update" — use a real upsert (Supabase-JS `.upsert(..., { onConflict: 'media_id,platform_id,country,offer_type' })` or equivalent) so a second load of the identical file cannot create a duplicate row.</note>
    <note>The expire step (schema doc Section 3.3, step 3) uses `last_snapshot_id is distinct from :snapshot_id`, which ALSO matches rows where last_snapshot_id is null. A naive Supabase-JS `.neq('last_snapshot_id', snapshotId)` silently excludes null rows in Postgres and is NOT equivalent — preserve the "is distinct from" semantics exactly (e.g. `.or('last_snapshot_id.is.null,last_snapshot_id.neq.' + snapshotId)`, or execute the literal SQL from the schema doc via a Postgres function/RPC).</note>
    <note>lib/supabase/admin.ts does not exist yet. Per ARCHITECTURE.md it is introduced by RIK-2 (auth/routing ticket) but this ticket is its first real consumer. CHECK whether RIK-2 has already landed it before creating one — do not create a second, conflicting service-role client. If it doesn't exist, create the minimal version yourself: a service-role client factory using @supabase/supabase-js's createClient (NOT @supabase/ssr's cookie-bound client) with SUPABASE_SERVICE_ROLE_KEY, server-only.</note>
    <note>Never import lib/supabase/admin.ts from actions/, features/, or any client bundle — it is reserved exclusively for ingestion/ routines (ARCHITECTURE.md, "Conventions worth preserving").</note>
    <note>@supabase/supabase-js and @supabase/ssr are not yet in package.json. Add @supabase/supabase-js if it's still missing when you start (admin.ts needs the plain client, not the ssr cookie-bound one). Check package.json first — RIK-1/RIK-2 may have already added it.</note>
    <note>No script runner (tsx/ts-node) is configured in package.json. Ingestion is explicitly documented as outside the Next.js request/response cycle (ARCHITECTURE.md) — do not build a Next.js API route for this. Add tsx as a devDependency and an npm script instead.</note>
    <note>constants/platforms.ts does not exist yet (ARCHITECTURE.md references it as the future map of "known platform slugs/provider ids, used when mapping incoming catalog files to platforms rows") — this ticket creates it.</note>
    <note>Nothing in RIK-1's scope documents seeding the platforms table with real rows. Do not assume a platforms row exists for a given slug — find it by slug, and create it from constants/platforms.ts if missing, rather than throwing on a brand-new platform's first file.</note>
    <note>types/ and services/ barrels (types/index.ts, services/index.ts) do not exist yet either. If a sibling ticket created them first, extend — do not overwrite or duplicate existing exports.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="1. Input contract and fixtures">
      <item>Create ingestion/catalog/types.ts defining the raw file contract (this spec's inferred default, document the assumption in a code comment): a top-level object with `metadata: { generated_at: string }` and `items: RawCatalogItem[]`, where RawCatalogItem has `imdb_id: string` (required), `title: string` (required), `year?: number`, `url?: string`, `offer_type?: 'subscription' | 'rent' | 'buy'`, `type?: 'movie' | 'tv'`.</item>
      <item>Create at least three fixture files under ingestion/catalog/__fixtures__/ following the `<platform-slug>_<COUNTRY>.json` naming convention (e.g. a "before" file, an "after" file removing one title present in "before" to prove the expiry criterion, and confirm the "before" file re-run proves idempotency).</item>
    </phase>

    <phase title="2. Shared utilities">
      <item>Create lib/supabase/admin.ts if it does not already exist (check first) — service-role Supabase client using @supabase/supabase-js, reading SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from env, server-only (no "use client").</item>
      <item>Create lib/slug.ts — a pure function `generateSlug(title: string, year?: number, disambiguator?: string): string` producing a kebab-case slug, with the disambiguator appended only when the caller detects a collision (the caller, in services/MediaServices, is responsible for retrying with a disambiguator on a unique-constraint violation).</item>
      <item>Create constants/platforms.ts — a typed map/array of known platform slug → { name, providerIdMovie?, providerIdTv? }, seeded with at least the platforms referenced in your fixtures.</item>
    </phase>

    <phase title="3. Types">
      <item>Create types/MediaItem.ts, types/Platform.ts, types/CatalogSnapshot.ts, types/MediaAvailability.ts (only the ones missing) matching the real migration's columns exactly, and aggregate them in types/index.ts.</item>
    </phase>

    <phase title="4. Services">
      <item>Create services/CatalogSnapshotServices/index.ts: a class taking a SupabaseClient in its constructor, with methods to create a snapshot row (platform_id, country, generated_at, source_file, total_items=0, status='pending'), and to update it to status='completed' (with the final total_items) or status='failed'.</item>
      <item>Create services/MediaServices/index.ts (or extend it if it exists): an upsert-or-create-stub method keyed by imdb_id — look up by imdb_id, return the existing id if found, otherwise insert with is_stub=true, type defaulted per the ground-truth note above, and a slug from lib/slug.ts (retrying once with a disambiguator on a unique violation).</item>
      <item>Create services/MediaAvailabilityServices/index.ts: an upsert method (media_id, platform_id, country, url, offer_type, last_seen_at, last_snapshot_id, is_available=true) using onConflict against the media_availability_uq columns, and an expireStale method implementing schema doc Section 3.3 step 3 exactly (platform_id + country scoped, is distinct from semantics preserved, is_available currently true).</item>
      <item>Export all three from services/index.ts.</item>
    </phase>

    <phase title="5. Ingestion routine">
      <item>Create ingestion/catalog/resolvePlatform.ts: given a file path, parse the `<platform-slug>_<COUNTRY>.json` filename, find the platforms row by slug via the admin client, create it from constants/platforms.ts if missing, and return { platformId, country }.</item>
      <item>Create ingestion/catalog/parseCatalogFile.ts: read + JSON.parse the file, validate it against the RawCatalogFile shape (fail loudly and clearly on a malformed file rather than partially ingesting).</item>
      <item>Create ingestion/catalog/run.ts exporting `ingestCatalogFile(filePath: string): Promise&lt;{ snapshotId: string; totalItems: number; expiredCount: number }&gt;` implementing, in order: (1) resolvePlatform, (2) parseCatalogFile, (3) CatalogSnapshotServices.createSnapshot, (4) for each item: MediaServices upsert-or-stub then MediaAvailabilityServices.upsert with last_snapshot_id = the new snapshot id and last_seen_at = metadata.generated_at, (5) MediaAvailabilityServices.expireStale scoped to this platform+country+snapshot, (6) CatalogSnapshotServices mark completed with the final total_items, catching any error to mark the snapshot failed instead of completed and rethrow.</item>
      <item>Add a CLI entry point at the bottom of run.ts (or a thin wrapper) reading a `--file &lt;path&gt;` argument from process.argv and calling ingestCatalogFile, so it can run standalone via a script command.</item>
    </phase>

    <phase title="6. Script wiring">
      <item>Add tsx to package.json devDependencies.</item>
      <item>Add an "ingest:catalog" script to package.json: "tsx ingestion/catalog/run.ts", usable as `npm run ingest:catalog -- --file &lt;path&gt;`.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Running `npm run ingest:catalog -- --file &lt;fixture&gt;` for one platform/country creates exactly one new catalog_snapshots row (verify via `select * from catalog_snapshots where source_file = '&lt;fixture filename&gt;' order by created_at desc limit 1;`) and every item in the fixture has a matching media_availability row with last_snapshot_id equal to that snapshot's id and last_seen_at equal to the fixture's metadata.generated_at.</criterion>
    <criterion id="AC-2">Running the "before" fixture then the "after" fixture (same platform+country, one title removed) leaves the removed title's media_availability row with is_available = false and the row still present (row count unchanged, not deleted) — verify via `select is_available, last_snapshot_id from media_availability where media_id = (select id from media_items where imdb_id = '&lt;removed imdb_id&gt;') and platform_id = '&lt;id&gt;' and country = '&lt;code&gt;';`.</criterion>
    <criterion id="AC-3">Running the identical fixture file twice results in exactly one media_availability row per (media_id, platform_id, country, offer_type) combination, not two — verify via `select count(*) from media_availability where media_id = '&lt;id&gt;' and platform_id = '&lt;id&gt;' and country = '&lt;code&gt;' and offer_type = 'subscription';` returning 1.</criterion>
    <criterion id="AC-4">`npm run ingest:catalog -- --file &lt;path&gt;` runs start to finish with exit code 0 and requires no manual SQL statement between or during runs.</criterion>
    <criterion id="AC-5">A title present in a fixture's items but not previously in media_items is created with is_stub = true and the fields available in the fixture (title, year, imdb_id) — verify via `select is_stub, title, year from media_items where imdb_id = '&lt;new imdb_id&gt;';`.</criterion>
    <criterion id="AC-6">catalog_snapshots.status ends as 'completed' with total_items equal to the number of items processed from the fixture on a successful run — verify via `select status, total_items from catalog_snapshots where id = '&lt;snapshot id&gt;';`.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create or edit any file under supabase/migrations/ — this ticket assumes RIK-1's tables already exist as-is. If a column this spec assumes is genuinely missing from the real migration, stop and report it instead of altering the schema.</item>
    <item>Do NOT import lib/supabase/admin.ts from actions/, features/, components/, or any client component — it is exclusive to ingestion/.</item>
    <item>Do NOT rename or repurpose media_availability_uq, media_items_imdb_id_uq, or media_items_slug_uq — implement upserts against the existing constraints as-is.</item>
    <item>Do NOT delete rows from media_availability to represent "no longer available" — is_available = false is the only correct representation; deleting destroys the availability history the schema was explicitly designed to preserve.</item>
    <item>Do NOT mark a catalog_snapshots row 'completed' unless the full run (all upserts + the expire step) succeeded.</item>
    <item>Do NOT build any app/ route, features/ slice, or UI for this ticket — it is explicitly a backend-only routine.</item>
    <item>Do NOT add a general test framework (vitest/jest) as part of this ticket.</item>
  </constraints>

  <out_of_scope>
    <item>Fixing series catalog completeness upstream — known external-process gap (schema doc Section 11 item 1, product spec Section 13), not fixable from this ticket.</item>
    <item>Stub enrichment (poster/synopsis/cast) for is_stub = true titles — separate future process.</item>
    <item>Scheduling/cron automation of the routine — this ticket only delivers a script runnable on demand.</item>
    <item>Deep-link URL resolution beyond whatever the raw file's own `url` field provides.</item>
    <item>Any offer_type differentiation policy beyond passing through what the file provides.</item>
    <item>Any UI, admin screen, or run-history display for catalog_snapshots.</item>
  </out_of_scope>

  <implementation_notes>
    <item>ingestion/catalog/run.ts — export `ingestCatalogFile(filePath: string): Promise&lt;{ snapshotId: string; totalItems: number; expiredCount: number }&gt;` as the reusable entry point (so a future scheduler can import it directly instead of shelling out).</item>
    <item>ingestion/catalog/resolvePlatform.ts — export `resolvePlatform(filePath: string, client: SupabaseClient): Promise&lt;{ platformId: string; country: string }&gt;`.</item>
    <item>lib/slug.ts — export `generateSlug(title: string, year?: number, disambiguator?: string): string`.</item>
    <item>services/MediaAvailabilityServices/index.ts — export an `expireStale(params: { platformId: string; country: string; snapshotId: string }): Promise&lt;number&gt;` returning the count of rows flipped, useful for the AC-1/AC-6 verification and for the completion report.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases above, created or extended as needed.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>Persist documentation per &lt;completion_report&gt; &lt;persistence&gt; below: one bullet in CHANGELOG.md under [Unreleased], and one file in specs/logs/.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Exact raw JSON file shape from the external process — no real sample shipped with this ticket. Default: the RawCatalogFile/RawCatalogItem contract in Phase 1 above. Proceed with this default; adjust parseCatalogFile.ts later if a real sample contradicts it.</item>
    <item>Whether RIK-1 has actually landed with the exact DDL quoted in this prompt. Default: assume yes, but re-read the real migration file first per the ground_truth_db_notes and adjust column references if anything drifted.</item>
    <item>Whether lib/supabase/admin.ts already exists from RIK-2. Default: check first; only create it if missing.</item>
    <item>media_items.slug generation algorithm — undocumented anywhere. Default: kebab-case(title) + year + collision suffix, per Phase 2.</item>
    <item>Whether the platforms table is pre-seeded by RIK-1. Default: assume not, and find-or-create by slug from constants/platforms.ts.</item>
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
        <item>Format: `- RIK-3: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-3_catalog_ingestion.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to catalog_ingestion, matching specs/backlog/RIK-3_catalog_ingestion.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-3_catalog_ingestion.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / ingestion / config), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-3 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the catalog loading routine" instead of naming ingestion/catalog/run.ts, "the availability record" instead of naming media_availability.</item>
      <item>Keep it under 15 lines. State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Omit the "## Screenshots" section entirely — this ticket has no user-visible UI changes.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works.</item>
      <item>This ticket is ingestion/business-logic only (no UI, no schema change beyond what RIK-1 already defined) — include "## Prerequisites" (local Supabase running with RIK-1's migration applied, SUPABASE_SERVICE_ROLE_KEY set, the fixture files available) and "## Logic validation": exact `npm run ingest:catalog -- --file &lt;path&gt;` commands to run in sequence (first load, second identical load, "after" load with a title removed), and the SQL queries from AC-1 through AC-6 to confirm each expected outcome, with what each query should return.</item>
      <item>Do NOT include a "## UI validation" section — there is no UI in this ticket.</item>
      <item>End with "## Expected outcome" — 3-6 bullets tying back to AC-1 through AC-6.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```

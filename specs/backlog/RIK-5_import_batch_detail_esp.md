# RIK-5 — Detalle de importación

> Documento fuente de verdad: `specs/backlog/RIK-5_import_batch_detail.md` (inglés). Este archivo es una ayuda de lectura en español; ante cualquier discrepancia, el archivo en inglés manda.

## Resumen del ticket

Da al usuario transparencia total sobre qué pasó durante una importación de CSV de IMDb: un historial en `/importar` que muestra cada lote pasado (fecha, tipo, resumen), y una página de detalle en `/importar/[batchId]` que lista cada fila de un lote elegido con su resultado individual.

- `/importar` lista los lotes de importación previos del usuario autenticado — fecha, tipo (calificaciones/watchlist), y resumen (total/reconocidos/creados/omitidos) — del más reciente al más antiguo.
- `/importar/[batchId]` lista todas las filas de ese lote (título, IMDb id, resultado) y solo es visible para el dueño del lote.
- Las filas con resultado `skipped` deben ser visualmente distinguibles (un badge/color distinto) de las filas `matched`/`created`.
- Este es un ticket **de solo lectura** construido sobre `imdb_import_batches` / `imdb_import_rows`, ambas escritas por el flujo de carga de RIK-4. RIK-5 no toca la carga, el parseo del CSV, ni la lógica de coincidencia.
- No existen comentarios del equipo para este ticket más allá de la nota de alcance ya incorporada en la descripción anterior (reutilizar el contenedor `/importar` de RIK-4, agregar el historial debajo, más la nueva ruta de detalle).

---

## Contexto

### Ticket original

**Descripción:** Vista `/importar/[batchId]` e historial de importaciones previas en `/importar`, mostrando fila por fila el resultado de cada lote (título, `imdb_id`, resultado) para dar transparencia total sobre qué pasó con cada título del CSV.

**Criterios de aceptación:**
- `/importar` lista los lotes previos del usuario con fecha, tipo y resumen (total/reconocidos/creados/omitidos), ordenados del más reciente al más antiguo.
- `/importar/[batchId]` muestra todas las filas de `imdb_import_rows` del lote con su resultado, y solo es accesible por el dueño del lote.
- Cada fila con resultado `skipped` es identificable visualmente (color/badge distinto).

El ticket nombra correctamente tablas y columnas reales (`imdb_import_rows`, `imdb_id`) a primera vista, pero al momento de este análisis **ninguno de `supabase/`, `types/`, `services/`, `actions/`, `features/`, `app/(app)/importar/`** existe todavía en el repositorio — es un scaffold de Next.js 16 recién creado. El ticket debe especificarse contra el esquema objetivo (`RIKUNA-PRD-schema-basedatos-rikuna.md`) y la arquitectura objetivo (`ARCHITECTURE.md`), no contra código que existe hoy.

### Comentarios del equipo

Se entregó una nota de alcance junto con el ticket (no es un comentario del tracker, pero se trata con la misma autoridad al ser la única aclaración disponible):

> Reutilizar el contenedor de listado de lotes que ya está en `/importar` (RIK-4 construyó ahí la UI de carga; este ticket agrega el historial debajo, en la misma ruta) más la nueva ruta de detalle `/importar/[batchId]`. Contrastar con `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Sección 2.2 (`/importar/[batchId]`) y `RIKUNA-PRD-documento-especificacion-rikuna.md` Sección 7.6 para las expectativas exactas de contenido (columnas título, imdb_id, resultado; acción de volver a importar).

Esta nota es la autoridad de alcance: **no reconstruir ni modificar** la UI de carga/dropzone/procesamiento de RIK-4 — solo agregar la sección de historial y la nueva ruta de detalle.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| Ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| "Vista `/importar/[batchId]` e historial ... en `/importar`" implica que estas rutas/UI ya existen parcialmente (RIK-4 construyó la UI de carga) | `app/` hoy solo tiene `layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico` — no existe `app/(app)/importar/`. `specs/backlog/RIK-1_database_schema_rls.md` (ya escrito, dependencia de este ticket) confirma que `supabase/`, `types/`, `services/`, `actions/` siguen vacíos. El backlog de RIK-4 tampoco existe aún. | El prompt de este ticket debe ser defensivo: verificar en tiempo de ejecución si RIK-4 ya aterrizó (su archivo de ruta, servicio, acción, tipos). Si sí, extender. Si la dependencia realmente no aterrizó cuando corra este prompt, el agente ejecutor debe detenerse y reportarlo en vez de inventar la lógica de carga de RIK-4 (fuera de alcance aquí). |
| "mostrando fila por fila el resultado de cada lote (título, `imdb_id`, resultado)" | Columnas reales confirmadas en `imdb_import_rows`: `title`, `imdb_id`, `result` (esquema doc Sección 7.1) — los nombres de campo del ticket coinciden exactamente con la BD, sin necesidad de renombrar. | Reutilización directa — sin columnas nuevas. |
| El ticket no nombra las columnas de resumen para el historial de `/importar` | Columnas reales en `imdb_import_batches`: `total_rows`, `matched_rows`, `created_rows`, `skipped_rows`, `source_type`, `created_at` (esquema doc Sección 7.1) | Usarlas directamente; no recalcular los conteos agregando `imdb_import_rows` en tiempo de lectura — RIK-4 es responsable de mantener correctos los contadores del lote. |
| Los valores de "resultado" son informalmente en español en el ticket ("reconocido/creado/omitido") y en el PRD de vistas | El enum `result` almacenado realmente es en inglés: `'matched' | 'created' | 'skipped'` (default `'pending'` antes de terminar el procesamiento), y `source_type` es `'ratings' | 'watchlist'` (esquema doc Sección 7.1, 7.3) | Traducir solo en la capa de copy de UI (etiquetas en español); mantener el valor almacenado/comparado en inglés en el código, según la regla de identificadores en inglés de `ARCHITECTURE.md`. |
| "solo es accesible por el dueño del lote" | `imdb_import_rows` **no tiene columna `user_id`** — la propiedad solo es alcanzable uniendo `batch_id → imdb_import_batches.user_id`. `specs/backlog/RIK-1_database_schema_rls.md` (ya redactado) se compromete a construir esto como una política RLS EXISTS-subquery, solo-dueño, en `imdb_import_rows`, siguiendo el patrón de `list_items` en la Sección 9.2 del esquema doc, pero **sin** la rama pública. | RLS debería aplicar esto a nivel de BD una vez que aterrice RIK-1, pero la capa de servicio/acción debe además hacer su propia verificación de propiedad (obtener primero el encabezado del lote) para que la UI pueda mostrar un "no encontrado" correcto en vez de una tabla vacía ambigua. Ver `Decisiones tomadas`. |
| `ARCHITECTURE.md` documenta `components/Table/` (`DataTable`, TanStack Table) como compartido entre "biblioteca" y "detalle de importación" | `components/Table/` no existe. `components/ui/` solo tiene `button.tsx`. No hay `@tanstack/react-table` en `package.json`. No existe un ticket de "Biblioteca" en la lista de tickets hermanos RIK-1…RIK-11 entregada, así que este ticket es probablemente el **primer consumidor real** de `DataTable`. | Construir `DataTable` como el componente genérico compartido en `components/Table/DataTable.tsx` (según la intención explícita de `ARCHITECTURE.md`), no como una tabla puntual dentro de `features/import/`. Agregar `@tanstack/react-table` como dependencia si aún falta. |
| El backlog de tickets hermanos lista este ticket como `depends_on RIK-4` solamente (no `RIK-2`, autenticación) | La ruta vive bajo el grupo autenticado `(app)` según la tabla de rutas de `ARCHITECTURE.md`, y el AC-2 requiere aplicar propiedad, lo cual implica una sesión iniciada | La capa de acción de este ticket debe hacer su propia verificación `supabase.auth.getUser()` sin importar si el guard compartido del layout `(app)` (RIK-2) ya aterrizó — no como reemplazo de RIK-2, solo como seguro ante el orden de construcción. |
| N/A (implícito) | `package.json` hoy no tiene instalado `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-table`, `zustand`, `react-hook-form`, ni `sonner` — confirmado leyendo el archivo directamente. | Se espera que RIK-1/RIK-4 instalen los paquetes del cliente Supabase; este ticket debe verificar independientemente que `@tanstack/react-table` esté presente (para `DataTable`) e instalarlo si no, en vez de asumir que otro ticket ya lo hizo. |
| N/A (versión de Next.js) | Este proyecto corre Next.js 16.3.0, donde el `params` de una ruta dinámica en `page.tsx` es una **Promise**, no un objeto plano (confirmado en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`) | `app/(app)/importar/[batchId]/page.tsx` debe ser `async function Page({ params }: { params: Promise<{ batchId: string }> })` y hacer `await params` antes de usar `batchId` — escribirlo como prop síncrona (patrón pre-v15) rompe. |

### Estado actual en la base de datos

Confirmado leyendo `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 7.1 (el esquema doc, ya que no existe ninguna migración real todavía — `supabase/` está ausente) y contrastado con `specs/backlog/RIK-1_database_schema_rls.md` (ya redactado):

```sql
create table if not exists public.imdb_import_batches (
    id             uuid default gen_random_uuid() not null primary key,
    created_at     timestamptz default now() not null,
    user_id        uuid not null references auth.users(id) on delete cascade,
    source_type    varchar not null,   -- 'ratings' | 'watchlist'
    file_name      varchar,
    status         varchar default 'pending' not null,
    total_rows     integer default 0 not null,
    matched_rows   integer default 0 not null,  -- ya existían en el catálogo
    created_rows   integer default 0 not null,  -- se crearon como stub
    skipped_rows   integer default 0 not null,
    completed_at   timestamptz
);
create index if not exists imdb_batches_user_idx on public.imdb_import_batches (user_id, created_at desc);

create table if not exists public.imdb_import_rows (
    id          uuid default gen_random_uuid() not null primary key,
    batch_id    uuid not null references public.imdb_import_batches(id) on delete cascade,
    imdb_id     varchar not null,     -- columna "Const"
    title       varchar,
    title_type  varchar,              -- columna "Title Type"
    year        integer,
    your_rating smallint,             -- solo en export de calificaciones
    date_rated  date,
    media_id    uuid references public.media_items(id),
    result      varchar default 'pending' not null  -- 'matched' | 'created' | 'skipped'
);
create index if not exists imdb_rows_batch_idx on public.imdb_import_rows (batch_id);
```

**RLS (según Sección 9 del esquema doc + el enfoque comprometido por RIK-1):**
- `imdb_import_batches`: solo-dueño vía `auth.uid() = user_id` (el patrón estándar de la Sección 9.1 — tiene columna `user_id` directa).
- `imdb_import_rows`: solo-dueño vía una política EXISTS-subquery uniendo `batch_id → imdb_import_batches.user_id` (sin columna `user_id` directa; sin rama pública — esta tabla nunca es legible públicamente).

**Uso en código:** ninguno. No se ha construido nada contra estas tablas todavía en este repositorio — `types/`, `services/`, `actions/`, `features/`, y las rutas `app/(app)/importar/*` están todas ausentes. Este ticket, junto con RIK-4, es el primer consumidor real.

**Comportamiento actual:** N/A — las rutas no existen.

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| fecha (historial de lotes) | timestamp | `imdb_import_batches.created_at` | ya existe (reutilizar) |
| tipo (historial de lotes) | enum | `imdb_import_batches.source_type` (`'ratings' \| 'watchlist'`) | ya existe (reutilizar) |
| resumen: total | integer | `imdb_import_batches.total_rows` | ya existe (reutilizar) |
| resumen: reconocidos | integer | `imdb_import_batches.matched_rows` | ya existe (reutilizar) |
| resumen: creados | integer | `imdb_import_batches.created_rows` | ya existe (reutilizar) |
| resumen: omitidos | integer | `imdb_import_batches.skipped_rows` | ya existe (reutilizar) |
| título (fila) | text | `imdb_import_rows.title` | ya existe (reutilizar) |
| imdb_id (fila) | text | `imdb_import_rows.imdb_id` | ya existe (reutilizar) |
| resultado (fila) | enum | `imdb_import_rows.result` (`'matched' \| 'created' \| 'skipped'`, default `'pending'`) | ya existe (reutilizar) |
| dueño del lote (control de acceso) | — | `imdb_import_batches.user_id` (FK directa) + `imdb_import_rows` vía join (política EXISTS de RIK-1) | ya existe (reutilizar) — RLS de RIK-1, más una verificación explícita de propiedad en la capa de acción (ver Decisiones tomadas) |

No se requieren columnas ni tablas nuevas para este ticket.

### Archivos impactados

- **Tipos** — `types/ImdbImport.ts` (o el barrel existente `types/index.ts` si RIK-4 ya lo creó): `ImdbImportBatch`, `ImdbImportRow` según el esquema anterior. Extender si RIK-4 los creó primero; crear si no.
- **Servicios** — `services/ImdbImportServices/index.ts`: agregar `listBatchesForUser(userId)` y `getBatchWithRows(batchId, userId)`. Extender la clase de servicio existente si RIK-4 ya la creó (tendrá métodos de escritura para el flujo de carga); no duplicar la clase.
- **Acciones** — `actions/imdb-import/index.ts`: agregar `getImportBatches()` y `getImportBatchDetail(batchId)` Server Actions — verificación de sesión vía `supabase.auth.getUser()`, instanciar `ImdbImportServices` con el cliente de la request, devolver `null`/redirigir si no hay sesión o no hay propiedad.
- **Componentes (compartidos)** — `components/Table/DataTable.tsx` (nuevo, wrapper de TanStack Table según `ARCHITECTURE.md`) si no existe; `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx` (primitivas shadcn, `style: base-lyra`, `baseColor: mist`) si no están agregadas — hoy solo existe `button.tsx`.
- **Features** — `features/import/components/BatchHistoryList.tsx` (renderiza la sección de historial en `/importar`), `features/import/components/BatchDetailTable.tsx` (renderiza las filas de `/importar/[batchId]` vía `DataTable`), `features/import/components/ImportResultBadge.tsx` (mapeo compartido resultado → etiqueta en español + variante de Badge, reutilizado por la tabla de detalle y, si sirve, por el resumen del historial).
- **Rutas de la app** — `app/(app)/importar/page.tsx`: extender si RIK-4 ya lo creó (agregar la sección de historial debajo de la UI de carga existente, sin tocar el código de dropzone/carga); crear una versión mínima con solo la sección de historial (y un placeholder `TODO: UI de carga — RIK-4`) si RIK-4 no ha aterrizado todavía. `app/(app)/importar/[batchId]/page.tsx` (nuevo): encabezado del lote + `BatchDetailTable` + acción de volver a `/importar`; `notFound()` cuando el lote no existe o no pertenece al usuario actual.
- **Tests** — no existe suite de tests todavía en este repositorio; anotar dónde vivirían los tests (`features/import/__tests__/` o `*.test.tsx` co-ubicados) si se introduce uno más adelante, pero no configurar un test runner como parte de este ticket.

### Decisiones tomadas

1. **La verificación de propiedad ocurre en la capa de acción/servicio, no solo vía RLS.** Obtener primero el encabezado del lote (fila de `imdb_import_batches`); si vuelve `null` (ya sea porque no existe o porque RLS lo filtró por no ser el dueño — indistinguible desde el punto de vista del cliente, lo cual es correcto: los no-dueños no deben poder saber si el lote existe), la página llama a `notFound()`. Solo se obtienen las `imdb_import_rows` una vez que el encabezado confirma la propiedad. **Default recomendado**, no confirmado por el usuario — la alternativa de confiar solo en RLS también funcionaría para el aislamiento de datos pero da una UX peor (no se puede distinguir "cero filas en un lote propio vacío" de "el lote no existe" sin este fetch en dos pasos).
2. **Las filas omitidas usan `variant="destructive"` en el Badge de shadcn**, las `matched` usan `variant="secondary"`, las `created` usan `variant="default"` — usando las tres variantes estándar de Badge de shadcn ya disponibles en el estilo `base-lyra` en vez de inventar nuevos tokens de color. **Default recomendado.**
3. **Sin paginación del lado del servidor para la tabla de detalle de filas.** Los exports de CSV de IMDb son historiales de visualización personales (típicamente cientos a unos pocos miles de filas); el propio criterio de aceptación del ticket dice "muestra todas las filas". Usar la paginación/orden del lado del cliente incorporada en `DataTable` (TanStack Table) en vez de agregar parámetros de query `LIMIT`/`OFFSET`. **Default recomendado** — revisar si un export real de un usuario resulta demasiado grande en la práctica.
4. **`DataTable` se construye como el componente genérico compartido** en `components/Table/DataTable.tsx`, según la declaración explícita de `ARCHITECTURE.md` de que está pensado tanto para "biblioteca" como para "detalle de importación", aunque no exista todavía un ticket de Biblioteca en el backlog de hermanos actual. Este ticket se trata como el primer consumidor real que establece esa ubicación compartida. **Default recomendado.**
5. **Estado vacío en `/importar` (cero lotes)** replica el patrón de estado vacío ya existente en el producto (p. ej. el mensaje "importa desde IMDb" de Biblioteca según el PRD de vistas): un mensaje corto invitando al usuario a importar su primer archivo, no una tabla en blanco ni un error. **Default recomendado**, copy exacto a definir por el agente implementador.
6. **La acción "volver a Importar" de `/importar/[batchId]`** (PRD Sección 7.6) es un `<Button variant="outline">` con `next/link` de vuelta a `/importar`, no una llamada al historial del navegador — mantiene el comportamiento determinista sin importar el historial de navegación. **Default recomendado.**
7. **Este ticket no toca `supabase/migrations/`.** El RLS de `imdb_import_rows` (la política EXISTS-subquery, solo-dueño) es enteramente alcance de RIK-1 según `specs/backlog/RIK-1_database_schema_rls.md`. Si RIK-1 no ha aterrizado, o su política de `imdb_import_rows` falta o es incorrecta al momento de ejecución, el agente implementador debe detenerse y reportarlo como bloqueante en vez de escribir una migración él mismo o entregar una ruta de lectura sin aplicación de propiedad. **Default recomendado**, mantiene los límites de capas limpios según `ARCHITECTURE.md`.

### Fuera de alcance

- Carga de CSV, parseo, coincidencia (clasificación `matched`/`created`/`skipped`) y upserts de `user_media_status` — enteramente RIK-4.
- Esquema y RLS de `imdb_import_batches` / `imdb_import_rows`, incluyendo la política de propiedad basada en join — enteramente RIK-1 (ya redactado).
- El guard de autenticación compartido del layout del grupo `(app)` (`AuthCheck`, `UserProvider`) — RIK-2. Este ticket agrega su propia verificación de sesión defensiva en la capa de acción, pero no construye el guard compartido.
- Política de reconciliación de bajas de watchlist (esquema doc Sección 11, punto 4) — pertenece a la lógica de procesamiento de RIK-4, no a este ticket de solo lectura.
- Paginación, filtrado o búsqueda del lado del servidor en la tabla de detalle del lote — no solicitado por el ticket; diferido hasta que se demuestre necesario.
- Cualquier UI para volver a correr o eliminar una importación pasada — no solicitado por el ticket.

---

## Plan de implementación

**Objetivo:** construir el historial de solo lectura en `/importar` y la página de detalle a nivel de fila en `/importar/[batchId]`, contra el esquema real de `imdb_import_batches` / `imdb_import_rows`, reutilizando el contenedor de carga de RIK-4 y el RLS de RIK-1 en vez de re-derivar ninguno de los dos.

**En alcance:**
1. `types/ImdbImport.ts` (o extender `types/index.ts`) — tipos `ImdbImportBatch`, `ImdbImportRow` según el esquema doc exactamente.
2. `services/ImdbImportServices` — agregar `listBatchesForUser(userId)` (ordenado `created_at desc`) y `getBatchWithRows(batchId, userId)` (encabezado del lote + filas, fetch en dos pasos seguro para la propiedad).
3. `actions/imdb-import` — agregar `getImportBatches()` y `getImportBatchDetail(batchId)` Server Actions con verificación explícita `supabase.auth.getUser()`.
4. `components/Table/DataTable.tsx` — wrapper genérico de TanStack Table (componente compartido, no específico de import); agregar primitivas shadcn `badge`, `card`, `table` si faltan.
5. `features/import/components/` — `BatchHistoryList`, `BatchDetailTable`, `ImportResultBadge`.
6. `app/(app)/importar/page.tsx` — extender con la sección de historial (o crear mínimamente si RIK-4 no ha aterrizado).
7. `app/(app)/importar/[batchId]/page.tsx` — nueva ruta de detalle, `params` asíncrono según Next.js 16, `notFound()` para no-dueños/lotes ausentes, acción de volver a `/importar`.

**Fuera de alcance:** lógica de carga/parseo/coincidencia (RIK-4), esquema/RLS (RIK-1), guard de autenticación de `(app)` (RIK-2), política de reconciliación, paginación más allá de la del lado del cliente, UI de re-ejecución/eliminación — ver arriba para las razones.

**Riesgos clave / compatibilidad:**
- `imdb_import_rows` no tiene columna `user_id` — no escribir ni asumir un filtro ingenuo `auth.uid() = user_id` contra ella en código de aplicación; la propiedad solo se resuelve a través del encabezado del lote.
- Si la política RLS de `imdb_import_rows` de RIK-1 falta al momento de ejecución, la ruta de lectura de este ticket devolvería nada (seguro pero roto) o, si RLS no está habilitado en absoluto, filtraría datos entre usuarios (inseguro) — de ahí la restricción explícita de "detenerse y reportar" en vez de entregar silenciosamente.
- `DataTable` y las primitivas shadcn que necesita (`badge`, `card`, `table`) no existen todavía — deben agregarse sin asumir que otro ticket ya lo hizo.

**Mapeo de criterios de aceptación:**

| AC del ticket | Cobertura de implementación |
| --- | --- |
| `/importar` lista lotes previos con fecha/tipo/resumen, más reciente primero | `BatchHistoryList` alimentado por `getImportBatches()` → `listBatchesForUser()`, ordenado `created_at desc` |
| `/importar/[batchId]` muestra todas las filas con resultado, solo el dueño | `BatchDetailTable` alimentado por `getImportBatchDetail()` → `getBatchWithRows()`; `notFound()` cuando el fetch del encabezado del lote devuelve null |
| Filas `skipped` visualmente distintas | `ImportResultBadge` mapea `result` a una variante de Badge distinta (`destructive` para `skipped`) |

---

## Prompt para Claude Code

```xml
<task id="RIK-5" title="Detalle de importación" depends_on="RIK-4">
  <role>
    You are a senior full-stack engineer working on Rikuna (Next.js 16 App Router + Supabase/Postgres).
    You are building the READ-ONLY history and detail views on top of the IMDb CSV import feature: a
    history list on /importar showing past import batches, and a new /importar/[batchId] page showing
    every row of one batch with its per-title result. You do NOT touch upload, CSV parsing, or matching
    logic — that is entirely RIK-4's scope, already implemented (or being implemented in parallel) as
    the writer of imdb_import_batches / imdb_import_rows.
  </role>

  <mandatory_reading>
    <item path="ARCHITECTURE.md">Layered + feature-sliced layout, auth boundaries (actions/ session
      checks, never import lib/supabase/admin.ts here), the (app)/(public) route groups, and the
      documented intent that components/Table/DataTable (TanStack Table) is shared between "biblioteca"
      and "import-batch detail".</item>
    <item path="AGENTS.md">This project runs a Next.js version with breaking changes versus your
      training data. Also read node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
      before writing app/(app)/importar/[batchId]/page.tsx — in this Next.js version, the `params` prop
      of a page component is a Promise and must be awaited.</item>
    <item path=".cursor/commands/makecommit.md">Commit message format and emoji mapping required by the
      completion_report's commit_message deliverable.</item>
    <item path="specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md">Section 2.2 — exact content expectations for
      /importar (dropzone, type selector, history table with date/type/summary) and /importar/[batchId]
      (row-by-row table: title, imdb_id, result; DataTable with a colored result Badge).</item>
    <item path="specs/RIKUNA-PRD-documento-especificacion-rikuna.md">Section 7.6 — "Detalle de
      importación": purpose (transparency on what happened per row), content (title, IMDb id, result),
      action (back to Importar).</item>
    <item path="specs/RIKUNA-PRD-schema-basedatos-rikuna.md">Section 7.1 (imdb_import_batches /
      imdb_import_rows DDL — copied into ground_truth_db_notes below, but read the section for full
      context), Section 9 / 9.1 / 9.2 (RLS patterns — imdb_import_rows uses the join-based pattern
      structurally similar to list_items in 9.2, minus the public branch).</item>
    <item path="specs/backlog/RIK-1_database_schema_rls.md">The already-drafted foundation ticket. Confirms
      imdb_import_batches uses the direct owner_all RLS pattern and imdb_import_rows uses an EXISTS-subquery
      policy joining to imdb_import_batches.user_id. If RIK-1 has landed by the time you run this, verify
      the actual migration matches this; if it has NOT landed, or the imdb_import_rows policy is missing,
      STOP and report it as a blocker in your completion report instead of writing a migration yourself or
      shipping a read path with no ownership enforcement.</item>
    <item path="package.json">Confirm exactly what's installed before assuming any Supabase client,
      @tanstack/react-table, or other ARCHITECTURE.md-listed dependency already exists.</item>
    <item path="components.json">shadcn config: style "base-lyra" (Base UI variant), baseColor "mist" —
      use this when adding any new shadcn primitive (badge, card, table).</item>
    <item path="components/ui/button.tsx">The only shadcn primitive that exists today — use it as the
      style/convention reference when adding badge.tsx, card.tsx, table.tsx.</item>
    <item path="supabase/migrations/">Read whatever migration files actually exist here at execution
      time (created by RIK-1) to confirm the real, applied table/column/RLS shape before writing any
      query against imdb_import_batches or imdb_import_rows.</item>
    <item path="app/(app)/importar/">Read RIK-4's existing upload page (if it has landed) before touching
      it — you are appending a history section, not rewriting the upload UI.</item>
    <item path="CHANGELOG.md">Format and where to append the one bullet for this ticket.</item>
    <item path="specs/logs/README.md">Work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna lets a user import their IMDb "Ratings" and "Watchlist" CSV exports. RIK-4 (upload flow,
    depended on by this ticket) processes an uploaded CSV, writes one row to imdb_import_batches per
    upload (with running counters), and one row to imdb_import_rows per CSV line (with a per-row
    result). This ticket is purely additive on the READ side: a history list of past batches on
    /importar, and a new /importar/[batchId] route showing every row of one batch. Nothing here writes
    to the database — only SELECT queries via services/actions, scoped to the signed-in user's own data.

    types/, services/, actions/, features/, and app/(app)/importar/ may or may not exist yet depending on
    whether RIK-4 has already run in this environment. Check each layer before creating it: if RIK-4
    already created ImdbImportServices, actions/imdb-import, types/ImdbImport (or an entry in
    types/index.ts), or app/(app)/importar/page.tsx, EXTEND those files with the read methods/UI this
    ticket needs — do not duplicate the service class, action barrel, or route file. If a layer genuinely
    does not exist yet, create the minimal version needed for this ticket's read paths only, and leave a
    `// TODO(RIK-4): ...` comment marking where the write-side logic belongs instead of stubbing it out
    yourself.
  </context>

  <ground_truth_db_notes critical="true">
    <note>Real tables are imdb_import_batches and imdb_import_rows (schema doc Section 7.1), created by
      RIK-1's migration(s), not by this ticket. Do not create or modify anything under
      supabase/migrations/ as part of this work.</note>
    <note>imdb_import_batches columns: id (uuid pk), created_at (timestamptz), user_id (uuid, fk
      auth.users), source_type ('ratings' | 'watchlist'), file_name (varchar, nullable), status
      (varchar, default 'pending'), total_rows / matched_rows / created_rows / skipped_rows (integer,
      default 0), completed_at (timestamptz, nullable). Indexed on (user_id, created_at desc).</note>
    <note>imdb_import_rows columns: id (uuid pk), batch_id (uuid, fk imdb_import_batches, on delete
      cascade), imdb_id (varchar, not null), title (varchar, nullable), title_type (varchar, nullable),
      year (integer, nullable), your_rating (smallint, nullable — ratings export only), date_rated (date,
      nullable), media_id (uuid, fk media_items, nullable), result (varchar, default 'pending' — real
      values are 'matched' | 'created' | 'skipped'). Indexed on batch_id.</note>
    <note>imdb_import_rows has NO user_id column. Do not write `.eq('user_id', ...)` against it — it does
      not exist and the query will error. Ownership is only reachable through batch_id →
      imdb_import_batches.user_id.</note>
    <note>The batch summary counters (total_rows, matched_rows, created_rows, skipped_rows) already exist
      as columns on imdb_import_batches. Use them directly for the /importar history list. Do NOT
      recompute them by counting/aggregating imdb_import_rows at read time — RIK-4 owns keeping those
      counters correct.</note>
    <note>result and source_type are stored as English varchar enums ('matched'/'created'/'skipped' and
      'ratings'/'watchlist' respectively). Keep the stored/compared values in English in code (constants,
      switch cases, type unions); only the rendered label shown to the user is Spanish
      ("reconocido"/"creado"/"omitido", "Calificaciones"/"Lista de seguimiento").</note>
    <note>RLS: imdb_import_batches uses the direct owner_all pattern (auth.uid() = user_id) since it has
      a user_id column. imdb_import_rows uses an EXISTS-subquery policy joining to
      imdb_import_batches.user_id (no public branch, never anon-readable) — this is RIK-1's committed
      design (specs/backlog/RIK-1_database_schema_rls.md), not something to re-derive or second-guess.
      Verify the actual applied policy at execution time; if it's missing, stop and report it rather than
      proceeding.</note>
    <note>Because RLS makes a non-owner's SELECT return zero rows (not an error), fetch the batch header
      row first, separately from the rows. If the batch header comes back null, treat it as "not found"
      (call notFound()) regardless of whether that's because the id doesn't exist or because the current
      user isn't the owner — do not leak which case it was. Only fetch imdb_import_rows once the header
      confirms ownership.</note>
    <note>Next.js 16: the page component's `params` prop is a Promise. Write
      `app/(app)/importar/[batchId]/page.tsx` as `async function Page({ params }: { params: Promise<{ batchId: string }> })`
      and `const { batchId } = await params;` — do not destructure params synchronously.</note>
    <note>package.json currently has none of @supabase/ssr, @supabase/supabase-js, @tanstack/react-table,
      zustand, react-hook-form, or sonner installed. Do not assume any of them exist — check package.json
      first and install @tanstack/react-table if DataTable needs it and it's still missing.</note>
    <note>Only components/ui/button.tsx exists under components/ui/ today. badge.tsx, card.tsx, and
      table.tsx must be added (shadcn style "base-lyra", baseColor "mist" per components.json) before
      they can be used by features/import components.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="1. Types">
      <item>Ensure ImdbImportBatch and ImdbImportRow types exist (types/ImdbImport.ts or an entry in
        types/index.ts, matching whatever convention RIK-4 already used if it landed first), with fields
        matching the columns listed in ground_truth_db_notes exactly (camelCase in TypeScript, mapped
        from the snake_case DB columns in the service layer — do not rename the DB columns themselves).</item>
    </phase>

    <phase title="2. Services">
      <item>In services/ImdbImportServices (extend if it exists, create if not — constructor takes a
        SupabaseClient per ARCHITECTURE.md's DI convention), add:
        listBatchesForUser(userId: string): Promise&lt;ImdbImportBatch[]&gt; — selects from
        imdb_import_batches ordered by created_at desc.</item>
      <item>getBatchWithRows(batchId: string, userId: string): Promise&lt;{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null&gt;
        — first selects the single batch row by id (rely on RLS + an explicit .eq('user_id', userId) as
        belt-and-suspenders since this table does have the column), returns null immediately if not
        found/not owned; only then selects all imdb_import_rows for that batch_id, ordered in a stable,
        sensible way (e.g. by title or by insertion order — id or a natural row order column if present).</item>
      <item>No row mapper should silently drop the result field, imdb_id, or title — these are the whole
        point of the detail view.</item>
    </phase>

    <phase title="3. Actions">
      <item>In actions/imdb-import (extend if it exists, create if not), add two Server Actions:
        getImportBatches() and getImportBatchDetail(batchId: string).</item>
      <item>Both must call supabase.auth.getUser() first (using the request-scoped server client from
        lib/supabase/server — never lib/supabase/admin.ts here) and return an empty result /
        redirect('/auth/login') when there is no session, even if the (app) layout guard (RIK-2) is
        also expected to have already redirected — treat this as defense-in-depth, not redundant.</item>
      <item>getImportBatches() calls ImdbImportServices.listBatchesForUser(user.id).</item>
      <item>getImportBatchDetail(batchId) calls ImdbImportServices.getBatchWithRows(batchId, user.id) and
        returns the result (including null) untouched — the page component decides what null means (404).</item>
    </phase>

    <phase title="4. Shared components">
      <item>If components/Table/DataTable.tsx does not exist, create it as a generic TanStack Table
        wrapper (columns + data props, sorting and client-side pagination built in) — this is meant to be
        reused later outside of import, per ARCHITECTURE.md, so keep it free of import-specific logic.</item>
      <item>Add shadcn primitives components/ui/badge.tsx, components/ui/card.tsx, components/ui/table.tsx
        if they don't already exist, matching the project's "base-lyra" style / "mist" base color and the
        existing button.tsx as a style reference. Respect the Lyra convention of border-radius 0 already
        configured globally — do not override it per-component.</item>
    </phase>

    <phase title="5. Feature components">
      <item>features/import/components/ImportResultBadge.tsx — maps a row's `result` value to a Spanish
        label and a Badge variant: 'matched' → "Reconocido" / variant="secondary"; 'created' → "Creado" /
        variant="default"; 'skipped' → "Omitido" / variant="destructive" (the visually distinct case
        required by AC-3); any other/pending value → a neutral fallback label/variant, not a crash.</item>
      <item>features/import/components/BatchHistoryList.tsx — renders the list of batches passed in as
        props (Server Component data flow per ARCHITECTURE.md: fetch in the page, pass initial data down):
        one row/card per batch showing created_at (formatted, e.g. relative or localized date), a label
        for source_type ("Calificaciones"/"Lista de seguimiento"), and the four counters
        (total/matched/created/skipped). Each item links to /importar/[batchId]. Renders an empty-state
        message (invite to import a first file) when the batches array is empty.</item>
      <item>features/import/components/BatchDetailTable.tsx — renders the batch's rows via DataTable with
        columns for title, imdb_id, and result (using ImportResultBadge for the result cell).</item>
    </phase>

    <phase title="6. Routes">
      <item>app/(app)/importar/page.tsx — if RIK-4 already created this file with the upload
        dropzone/type selector, APPEND a history section below it by calling getImportBatches() and
        rendering &lt;BatchHistoryList batches={batches} /&gt; — do not modify the existing upload code.
        If the file does not exist yet, create it with just the history section and a
        `{/* TODO(RIK-4): upload dropzone + type selector */}` placeholder comment where the upload UI
        belongs.</item>
      <item>app/(app)/importar/[batchId]/page.tsx (new) — async Server Component,
        `params: Promise<{ batchId: string }>`, await it, call getImportBatchDetail(batchId). If the
        result is null, call notFound() from next/navigation. Otherwise render a header with the batch's
        source_type label and created_at, the four summary counters, &lt;BatchDetailTable rows={rows} /&gt;,
        and a "Volver a Importar" Button/Link back to /importar.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">/importar lists the signed-in user's previous import batches with date
      (created_at), type (source_type, labeled in Spanish), and summary (total_rows, matched_rows,
      created_rows, skipped_rows), ordered from most recent to oldest (created_at desc). Verify by seeding
      2+ batches with different created_at values for one test user and confirming render order and
      displayed values match the DB rows.</criterion>
    <criterion id="AC-2">/importar/[batchId] shows every row of imdb_import_rows for that batch (title,
      imdb_id, result), and is only accessible by the batch's owner. Verify by: (a) as the owner, batch id
      renders a table whose row count and values match a direct SELECT against imdb_import_rows for that
      batch_id; (b) as a different authenticated user or as anon, the same URL renders Next.js's not-found
      UI (no batch data leaked).</criterion>
    <criterion id="AC-3">Every row with result = 'skipped' renders with a visually distinct Badge
      (variant="destructive") compared to 'matched' (variant="secondary") and 'created'
      (variant="default"). Verify by seeding a batch with at least one row of each result and inspecting
      the rendered Badge variant/class per row.</criterion>
    <criterion id="AC-4">app/(app)/importar/[batchId]/page.tsx correctly awaits the Promise-typed `params`
      prop (Next.js 16 contract) — verify by reading the file and confirming the async/await usage matches
      node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md's documented shape.</criterion>
    <criterion id="AC-5">A user with zero import batches sees an empty-state message on /importar (invite
      to import), not a blank table, an error, or a crash. Verify by rendering BatchHistoryList with an
      empty array.</criterion>
    <criterion id="AC-6">/importar/[batchId] includes a working "Volver a Importar" action that navigates
      back to /importar (PRD Section 7.6). Verify by inspecting the rendered link's href.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create, edit, or delete anything under supabase/migrations/ — RLS and schema for
      imdb_import_batches / imdb_import_rows are entirely RIK-1's scope. If RIK-1 hasn't landed, or its
      imdb_import_rows RLS policy is missing/incorrect, STOP and report it as a blocker in the
      verification_report instead of writing a migration or shipping an unenforced read path.</item>
    <item>Do NOT rename or restructure any existing column: imdb_id, title, result, source_type,
      total_rows, matched_rows, created_rows, skipped_rows, batch_id, user_id must stay exactly as named
      in the schema doc.</item>
    <item>Do NOT modify RIK-4's upload/dropzone/CSV-processing code in app/(app)/importar/page.tsx (if it
      exists) beyond appending the history section below it.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere in actions/ or features/import/ — this is a
      user-facing, session-scoped read path, not an ingestion routine.</item>
    <item>Do NOT write `.eq('user_id', ...)` against imdb_import_rows — the column doesn't exist there.
      Ownership flows through the batch header only.</item>
    <item>Do NOT add server-side pagination/filtering to the batch detail query — the ticket asks for all
      rows; use DataTable's client-side pagination if row count matters for rendering performance.</item>
    <item>Keep user-visible copy in Spanish and code identifiers (types, functions, variables) in English,
      per ARCHITECTURE.md.</item>
  </constraints>

  <out_of_scope>
    <item>CSV upload, parsing, IMDb matching/stub-creation logic, and user_media_status upserts — RIK-4.</item>
    <item>Database schema and RLS policies for imdb_import_batches / imdb_import_rows — RIK-1.</item>
    <item>The (app) route group's shared layout auth guard (AuthCheck, UserProvider, middleware redirect)
      — RIK-2. This ticket adds only its own defensive session check inside the Server Actions.</item>
    <item>Watchlist-removal reconciliation policy (schema doc Section 11 item 4) — RIK-4's concern.</item>
    <item>Re-running or deleting a past import batch — not requested by this ticket.</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/ImdbImportServices/index.ts — class ImdbImportServices { constructor(private supabase: SupabaseClient) {} async listBatchesForUser(userId: string): Promise&lt;ImdbImportBatch[]&gt; { ... } async getBatchWithRows(batchId: string, userId: string): Promise&lt;{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null&gt; { ... } }</item>
    <item>actions/imdb-import/index.ts — export async function getImportBatches(): Promise&lt;ImdbImportBatch[]&gt; and export async function getImportBatchDetail(batchId: string): Promise&lt;{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null&gt;</item>
    <item>app/(app)/importar/[batchId]/page.tsx — export default async function Page({ params }: { params: Promise&lt;{ batchId: string }&gt; }) { const { batchId } = await params; const detail = await getImportBatchDetail(batchId); if (!detail) notFound(); ... }</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in requirements phases 1–6, created or extended as specified.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>Persist documentation per completion_report/persistence below: one CHANGELOG.md bullet under
      [Unreleased], and one specs/logs/ file.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether RIK-4's app/(app)/importar/page.tsx, services/ImdbImportServices, actions/imdb-import,
      and types already exist at execution time is unknown ahead of time. Default: check first; extend if
      present, create the minimal read-only version with a TODO(RIK-4) marker if absent.</item>
    <item>Whether RIK-1's imdb_import_rows RLS policy has actually landed is unknown ahead of time.
      Default: verify against real migration files; if missing, stop and report as a blocker rather than
      guessing or writing the migration yourself.</item>
    <item>Exact empty-state and date-formatting copy for the history list. Default: short Spanish message
      inviting the user to import their first file; localized date format consistent with the rest of the
      app (implementer's judgment, no hard requirement from the ticket).</item>
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
      <item>Anything that could not be completed, with the blocker (including, if applicable, RIK-1 or RIK-4 not having landed, or the imdb_import_rows RLS policy being missing).</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-5: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-5_import_batch_detail.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-5_import_batch_detail.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / actions / components / features / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference the ticket id (RIK-5) in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and the product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; an optional "## Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the import history list" instead of naming the component, "the skipped-row badge" instead of naming the CSS variant.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots).</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing.</item>
      <item>Include "## Screenshots" (this ticket has user-visible UI changes — a new history list and a new detail page): list what to capture as numbered items, each with screen/area name, auth state, and what it should show. Suggest up to 4: (1) /importar with a populated history list — logged in; (2) /importar/[batchId] with a mix of matched/created/skipped rows, showing the skipped badge distinct; (3) /importar with zero batches — empty state; (4) /importar/[batchId] accessed as a non-owner — not-found state. Prefix each line with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable.</item>
      <item>This ticket is UI-focused (mixed with a light DB-read check): include "## Prerequisites" (dev server running, a signed-in test user, at least one imported batch with mixed results — seed via a direct SQL insert into imdb_import_batches/imdb_import_rows if RIK-4's upload UI isn't usable yet), "## UI validation" (numbered steps hitting /importar and /importar/[batchId] as owner and as a different user), "## Database validation" (a couple of read-only SQL checks confirming the displayed counts/rows match imdb_import_batches / imdb_import_rows), and "## Expected outcome" (bullets tying back to AC-1 through AC-6).</item>
      <item>Use real app paths: /importar, /importar/[batchId].</item>
      <item>SQL must be read-only SELECT statements only.</item>
    </deliverable>
  </completion_report>
</task>
```

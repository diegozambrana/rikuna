# RIK-1 — Esquema de base de datos y RLS

> Documento de lectura en español. La fuente de verdad es `specs/backlog/RIK-1_database_schema_rls.md` (inglés). El prompt XML de Claude Code es idéntico al del archivo primario, sin traducir.

## Resumen del ticket

Este es el ticket fundacional de Rikuna: crea todo el esquema de base de datos del MVP (14 tablas) y sus políticas de Row Level Security como migraciones de Supabase, para que cada ticket posterior (auth, ingesta, importaciones, panel, listas) tenga tablas reales sobre las cuales construir. Sin `depends_on` — este ticket no depende de nada y todo lo demás en el backlog hermano (RIK-2 … RIK-11) depende de él, directa o transitivamente.

- Crear las 14 tablas del MVP (`media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`, `user_subscriptions`, `user_media_status`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows`) con los tipos, constraints e índices exactos del documento de esquema.
- Crear la función trigger de `updated_at` y conectarla a `media_items`, `user_subscriptions`, `user_media_status`, `user_lists`.
- Habilitar RLS en cada tabla e implementar los tres patrones de acceso de la Sección 9: tablas de catálogo de lectura pública/escritura de servicio, tablas totalmente privadas por dueño, y el caso mixto público/privado en `user_lists`/`list_items` (incluyendo el `grant select ... to anon`).
- Los criterios de aceptación exigen verificar el aislamiento entre usuarios con dos cuentas de prueba reales y verificar el acceso anónimo (`anon`) a listas públicas vs. privadas — esto es una verificación contra base de datos viva, no solo una revisión del DDL.

## Contexto

### Ticket original

**Descripción:** Crear las migraciones de Supabase (`supabase/migrations/`) para todas las tablas del MVP: `media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`, `user_subscriptions`, `user_media_status`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows`. Incluye índices, constraints, triggers de `updated_at` y las políticas de RLS descritas en la Sección 9 del esquema (lectura pública de catálogo, aislamiento por dueño en datos personales, caso mixto público/privado en `user_lists`/`list_items`, incluyendo el `grant select ... to anon`).

**Criterios de aceptación:**

- [ ] Todas las tablas del esquema v3 existen con los tipos, constraints e índices definidos en `RIKUNA-PRD-schema-basedatos-rikuna.md`.
- [ ] RLS está habilitado en todas las tablas con datos de usuario; un usuario autenticado no puede leer ni escribir filas de `user_subscriptions`, `user_media_status`, `imdb_import_batches`/`rows` de otro usuario (verificado con dos cuentas de prueba).
- [ ] `user_lists`/`list_items` son legibles sin sesión (`anon`) solo cuando `is_public = true`; una lista privada devuelve vacío para `anon` y para otro usuario autenticado.
- [ ] `media_items`, `platforms`, `media_availability`, `catalog_snapshots`, `genres`, `people` son de lectura pública y de escritura solo para el rol de servicio.

Este es el texto tal como fue pegado desde el tracker — no existen comentarios adicionales del equipo para este ticket.

### Comentarios del equipo

Ninguno. Este ticket se entregó sin discusión de seguimiento — cada decisión de alcance a continuación es un default recomendado derivado directamente del PRD de esquema, no una decisión del equipo.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| "Crear las migraciones de Supabase (`supabase/migrations/`)" | `supabase/` no existe en absoluto — sin directorio, sin `config.toml`, sin migraciones previas | Esto es una creación desde cero, no una adición a un historial de migraciones existente. El agente que implemente puede necesitar crear `supabase/` él mismo (p. ej. `supabase init`) antes de agregar archivos de migración. |
| El ticket referencia "las políticas de RLS descritas en la Sección 9 del esquema" | La tabla de la Sección 9 solo nombra explícitamente `user_media_status`, `user_subscriptions`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows` y el grupo de catálogo `media_items, genres, people, platforms, media_availability, catalog_snapshots` — **no** menciona las tablas de unión `media_genres` / `media_people` | Estas dos tablas no tienen columna de dueño y son datos de catálogo puros (relaciones muchos-a-muchos entre `media_items` y `genres`/`people`), así que aplica el mismo patrón de lectura pública/escritura de servicio que sus tablas padre. Se trata como una extensión de la regla documentada, no una regla nueva — marcado como default abajo. |
| El ticket dice "triggers de `updated_at`" | La función trigger `public.handle_updated_at()` referenciada por nombre en las Secciones 2.1, 4 y 5 del documento de esquema nunca se define realmente en el documento | La función debe crearse en esta migración antes de los triggers que la invocan — está implícita, no detallada. Idioma estándar de Supabase: `new.updated_at = now(); return new;`. |
| El ticket dice que el AC cubre "RLS está habilitado en todas las tablas con datos de usuario" | Para que el AC-4 sea verdadero ("escritura solo para el rol de servicio" en tablas de catálogo), RLS debe estar habilitado también en las tablas de **catálogo**, no solo en las de datos personales | Sin `ENABLE ROW LEVEL SECURITY` en `media_items`, etc., los grants por defecto a nivel de proyecto de Supabase (el rol `authenticated` típicamente tiene INSERT/UPDATE/DELETE a nivel de tabla vía privilegios por defecto) permitirían que un usuario autenticado escriba directamente en tablas de catálogo incluso con una política SELECT permisiva. Esta es una corrección con impacto real — ver `ground_truth_db_notes` en el prompt. |

### Estado actual en la base de datos

No existe el directorio `supabase/migrations/` — no hay estado actual de base de datos que reconciliar. `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (esquema v3, Secciones 2–9) se trata como la verdad de esquema para este ticket, según el brief de la tarea, ya que es la primera migración jamás escrita para este proyecto. Las 14 tablas, cada columna, tipo, default, constraint e índice a continuación se copiaron de ese documento, no se re-derivaron.

Confirmado vacío/ausente antes de este ticket:

- `supabase/` — el directorio no existe (confirmado con `ls`).
- `types/`, `services/`, `actions/`, `ingestion/`, `hooks/`, `stores/`, `constants/`, `middleware.ts` — ninguno existe.
- `package.json` — no tiene instalado `@supabase/ssr`, `@supabase/supabase-js`, ni ninguna otra dependencia del stack documentada en `ARCHITECTURE.md`. Irrelevante para este ticket (SQL puro, sin código de cliente), pero confirma que nada río abajo puede conectarse todavía tampoco.

### Lógica actual (esquema / RLS)

No aplica — no hay lógica existente contra la cual comparar. El estado "actual" del esquema es el estado vacío.

### Mapeo de campos solicitados

No aplica en el sentido usual (cada campo es una creación neta, no una decisión de renombrar/reutilizar) — el documento de esquema es en cambio la fuente exacta de DDL. La tabla siguiente solo registra las dos extensiones ambiguas que el texto del ticket no detalla textualmente.

| Campo / política solicitado | Tipo / forma | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Función trigger `public.handle_updated_at()` | función trigger plpgsql | Ninguno — referenciada pero nunca definida en el documento de esquema | Debe crearse |
| RLS en `media_genres`, `media_people` | política de lectura pública, sin política de escritura | No nombradas en la tabla de la Sección 9 | Debe crearse (extendiendo el patrón del grupo de catálogo) |
| RLS en `imdb_import_rows` | solo dueño vía join | El patrón `auth.uid() = user_id` de la Sección 9.1 no aplica directamente — la tabla no tiene columna `user_id` | Debe crearse como política con subconsulta EXISTS que una con `imdb_import_batches.user_id`, reflejando el patrón de `list_items` en la Sección 9.2 pero sin la rama pública |

### Archivos impactados

- `supabase/migrations/<timestamp>_create_mvp_schema.sql` (nuevo) — las 14 tablas, índices, constraints, función `handle_updated_at()`, triggers.
- `supabase/migrations/<timestamp+1>_enable_rls_policies.sql` (nuevo) — `enable row level security` en las 14 tablas, todas las políticas de RLS de la Sección 9, las sentencias `grant select ... to anon, authenticated`.
- `supabase/config.toml` (nuevo, si aún no está creado) — necesario para que `supabase start` / `supabase db reset` existan y corran migraciones durante la verificación.
- `CHANGELOG.md` (modificado) — una línea bajo `[Unreleased] / Added`.
- `specs/logs/<YYYYMMDDHHmm>_RIK-1_database_schema_rls.md` (nuevo) — bitácora de trabajo.

Ningún archivo de `types/`, `services/`, `actions/` o `app/` se ve impactado — este ticket es exclusivamente de base de datos.

### Decisiones tomadas

1. **Dos archivos de migración, no uno.** `..._create_mvp_schema.sql` (DDL) y `..._enable_rls_policies.sql` (RLS + grants), aplicados en ese orden. Razón: refleja la estructura del propio ticket ("tablas... Incluye índices, constraints, triggers... y las políticas de RLS") y mantiene separado un rollback de esquema de uno de políticas. **Default recomendado, no confirmado por el usuario.**
2. **`handle_updated_at()` usa el idioma estándar de Supabase** (`new.updated_at = now(); return new;`, `language plpgsql`; no requiere `security definer` ya que solo modifica `NEW`). **Default recomendado.**
3. **`media_genres` y `media_people` reciben el mismo RLS de lectura pública/escritura de servicio que sus tablas padre**, aunque la tabla de la Sección 9 no las nombra explícitamente — no tienen columna de dueño y son datos de vínculo de catálogo puros. **Default recomendado.**
4. **`imdb_import_rows` recibe una política RLS con subconsulta EXISTS contra `imdb_import_batches.user_id`** (solo dueño, sin rama pública), ya que no tiene columna `user_id` propia. **Default recomendado.**
5. **Se agrega `grant select on <table> to anon, authenticated` explícito en cada tabla de catálogo pública** (`media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`), no solo en `user_lists`/`list_items` como se muestra literalmente en la Sección 9.2. Razón: la propia advertencia de la Sección 9.2 — "sin este grant, RLS nunca llega a evaluarse" — aplica igual a cualquier tabla que `anon` deba leer; depender de grants por defecto asumidos de Supabase no es verificable solo desde este repositorio. **Default recomendado.**
6. **Los pendientes de la Sección 11 quedan explícitamente diferidos**, no resueltos aquí (ver Fuera de alcance). Afectan lógica de ingesta/producto, no la forma del DDL/RLS.

### Fuera de alcance

- Tablas `seasons` / `episodes` — la Sección 2.3 del documento de esquema declara explícitamente que no cambian respecto a un esquema previo y "no forma parte del MVP." No se crean en este ticket.
- Lógica de upsert/expire de ingesta (Sección 3.3) y consultas de producto (Sección 8.1–8.3) — son lógica de capa de consulta/aplicación para RIK-3, RIK-4, RIK-7, RIK-8, no DDL.
- Capas de TypeScript `types/`, `services/`, `actions/` — pertenecen al ticket que primero las necesite (RIK-2 en adelante), según `ARCHITECTURE.md`.
- Rutas de auth, `middleware.ts`, guards de ruta — RIK-2.
- Datos semilla/fixtures — no solicitados por el ticket.
- Decisiones pendientes de la Sección 11 (completitud del catálogo de series, enlaces profundos, proceso de enriquecimiento de stubs, política de reconciliación de bajas en watchlist, alcance de `offer_type`, unicidad global del slug de listas públicas) — marcadas como seguimientos, no resueltas por esta migración.

---

## Plan de implementación

**Objetivo:** Levantar el esquema completo de Rikuna v3 y su modelo de RLS como las primeras migraciones de Supabase en este repositorio, para que cada ticket dependiente tenga tablas, constraints y reglas de acceso reales sobre las cuales construir.

**En alcance:**

1. **Migración 1 (DDL)** — función `public.handle_updated_at()`, luego las 14 tablas en orden de dependencia (catálogo → disponibilidad → personal → importaciones), con cada índice/constraint de las Secciones 2–7 del documento de esquema, y triggers de `updated_at` en las cuatro tablas que tienen la columna.
2. **Migración 2 (RLS)** — habilitar RLS en las 14 tablas; políticas de lectura pública/escritura de servicio + grants explícitos a `anon`/`authenticated` para las 8 tablas del dominio de catálogo; políticas solo-dueño (columna `user_id` directa) para `user_subscriptions`, `user_media_status`, `imdb_import_batches`; política solo-dueño con EXISTS para `imdb_import_rows`; el patrón mixto público/privado textual de la Sección 9.2 para `user_lists`/`list_items`, incluyendo su `grant select ... to anon, authenticated`.
3. **Verificación local** — crear `supabase/` si falta, correr las migraciones contra una instancia local de Supabase, crear dos usuarios de prueba, y confirmar cada criterio de aceptación con consultas reales bajo cada rol (`anon`, usuario A, usuario B, `service_role`).

**Fuera de alcance:** `seasons`/`episodes`, rutinas de ingesta, consultas de producto, capas de TypeScript, auth/middleware, datos semilla, decisiones de la Sección 11 — ver razones arriba.

**Riesgos clave / compatibilidad:**

- Olvidar habilitar RLS en las tablas de catálogo rompe silenciosamente el AC-4 (los grants por defecto permitirían que usuarios autenticados escriban en `media_items`, etc.).
- Olvidar los grants a `anon`/`authenticated` deja las políticas de RLS inalcanzables aunque estén correctas — el propio modo de falla documentado en la Sección 9.2.
- `imdb_import_rows` necesita una política basada en join, no el patrón simple `auth.uid() = user_id` — fácil de equivocarse copiando la Sección 9.1 tal cual.

**Mapeo de criterios de aceptación:**

| AC del ticket | Cobertura de implementación |
| --- | --- |
| Todas las tablas v3 existen con tipos/constraints/índices correctos | Migración 1, verificado con consultas a `information_schema` |
| RLS habilitado + aislamiento entre usuarios en tablas personales | Migración 2, verificado con dos cuentas de prueba contra `user_subscriptions`, `user_media_status`, `imdb_import_batches`/`rows` |
| `user_lists`/`list_items` públicas solo cuando están marcadas | Patrón de la Sección 9.2 en Migración 2, verificado como `anon` y como un segundo usuario autenticado |
| Tablas de catálogo de lectura pública / escritura solo de servicio | Políticas y grants del grupo de catálogo en Migración 2, verificado como `anon` y como usuario autenticado sin rol de servicio |

---

## Prompt para Claude Code

```xml
<task id="RIK-1" title="Esquema de base de datos y RLS">
  <role>
    You are a senior full-stack engineer working on Rikuna (Next.js 16 App Router + Supabase/Postgres),
    tasked with building the FOUNDATION database migration for the project. Nothing else in the codebase
    depends on this being done any particular way except that the table/column names and RLS behavior must
    match the schema doc exactly, since every future ticket (auth, ingestion, imports, panel, recommendations,
    lists) is built against this schema.
  </role>

  <mandatory_reading>
    <item path="ARCHITECTURE.md">Layered + feature-sliced layout; read the "Database (migrations)" and
      "Supabase integration" sections. Confirms: per-user isolation via user_id + RLS on all tables,
      public-by-flag exception on user_lists/list_items, UUID PKs, imdb_id as universal join key,
      time-aware availability model, and the rule "Do not edit existing migration files; add a new
      YYYYMMDDHHMMSS_&lt;name&gt;.sql for schema changes."</item>
    <item path="AGENTS.md">Read for the Next.js version-caveat pointer. This ticket does not touch any
      Next.js application code (no app/, no client/server components) — it is pure SQL migrations under
      supabase/migrations/ — so the node_modules/next/dist/docs/ reading requirement does not apply here.</item>
    <item path=".cursor/commands/makecommit.md">Commit message format and emoji mapping needed for the
      commit_message deliverable below.</item>
    <item path="specs/RIKUNA-PRD-schema-basedatos-rikuna.md">THE PRIMARY SOURCE for this ticket. Sections 2–7
      contain the exact, copy-ready SQL DDL for every table (columns, types, defaults, constraints, indexes).
      Section 9 (especially 9.1 and 9.2) contains the exact, copy-ready RLS policy SQL, including the anon
      grant. Section 11 lists open product/schema questions that are explicitly OUT OF SCOPE for this ticket —
      read it so you flag them correctly instead of trying to resolve them.</item>
    <item path="CHANGELOG.md">Format and where to append the [Unreleased] entry.</item>
    <item path="specs/logs/README.md">Work log filename convention and template to follow.</item>
  </mandatory_reading>

  <context>
    This repository has NO supabase/ directory yet — no config.toml, no prior migrations. This is the very
    first migration ever written for this project. Nothing in types/, services/, actions/, ingestion/ exists
    either, and none of those layers should be created by this ticket — it is strictly database DDL + RLS.
    package.json currently has no @supabase/* dependency; that is expected and irrelevant here since this
    ticket writes no application code.

    The schema is called "v3" in the PRD doc. It replaces older, undocumented iterations — do not look for or
    reconcile against any prior schema version; specs/RIKUNA-PRD-schema-basedatos-rikuna.md Sections 2–9 is the
    single source of truth for this ticket.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/ does not exist at all in this repo (verified: `ls supabase` fails). You must scaffold it
      (e.g. `supabase init`, or manually create supabase/config.toml + supabase/migrations/) before you can add
      migration files and run them locally for verification.</note>
    <note>The trigger function public.handle_updated_at() is referenced BY NAME in schema doc Sections 2.1
      (media_items), 4 (user_subscriptions) and 5 (user_media_status) via `create or replace trigger ... execute
      function public.handle_updated_at()`, but the function itself is never defined anywhere in the doc. You
      must create it in your DDL migration, before any trigger references it. Standard Supabase idiom:
      `new.updated_at = now(); return new;` in `plpgsql`.</note>
    <note>Only 4 of the 14 tables have an updated_at column and therefore a trigger: media_items,
      user_subscriptions, user_media_status, user_lists. Do NOT add updated_at (or its trigger) to the other 10
      tables — the schema doc deliberately omits it there (e.g. catalog_snapshots, media_availability, list_items,
      imdb_import_batches, imdb_import_rows use created_at/first_seen_at/last_seen_at instead, or no timestamp
      at all).</note>
    <note>RLS must be ENABLED on ALL 14 tables, not only the ones holding personal data. Reason: Supabase's
      default project-level privileges typically grant the `authenticated` role table-level INSERT/UPDATE/DELETE
      on public schema tables. If you enable RLS only on the personal-data tables and merely add a permissive
      SELECT policy to catalog tables (media_items, genres, media_genres, people, media_people, platforms,
      catalog_snapshots, media_availability) WITHOUT enabling RLS on them, those default grants would still let
      an authenticated end user write to media_items directly — silently failing acceptance criterion "de
      escritura solo para el rol de servicio". Enable RLS + add a SELECT-only policy + add no write policy on
      those tables; service_role bypasses RLS automatically in Supabase (BYPASSRLS) so ingestion still works.</note>
    <note>Section 9's RLS table in the schema doc does not explicitly list media_genres or media_people (the
      junction tables). Treat them as part of the same catalog group as their parents (media_items, genres,
      people): enable RLS, add a public SELECT policy (`using (true)`), add no write policy, and add the same
      explicit `grant select ... to anon, authenticated` as the other catalog tables.</note>
    <note>imdb_import_rows has NO user_id column — only batch_id referencing imdb_import_batches.user_id. The
      simple Section 9.1 pattern (`auth.uid() = user_id`) does not apply to this table. Build an EXISTS-subquery
      policy joining to imdb_import_batches, structurally similar to the list_items policy in Section 9.2, but
      WITHOUT any public/anon branch — imdb_import_rows is never publicly readable, only owner-readable via its
      parent batch's user_id.</note>
    <note>Section 9.2's own text explains why the explicit `grant select ... to anon, authenticated` is required
      in addition to the RLS policy: "sin este grant, RLS nunca llega a evaluarse y el visitante no ve nada."
      Apply the same explicit grant statement to every table anon/authenticated must read from — not just
      user_lists/list_items — rather than assuming Supabase's default project grants already cover it.</note>
    <note>seasons and episodes tables are explicitly declared NOT part of the MVP in schema doc Section 2.3
      ("Se mantiene igual que en tu esquema actual... No se detalla aquí porque no cambia y no forma parte del
      MVP."). Do not create them.</note>
    <note>Table and column names in the schema doc are the final names — do not rename anything for
      "consistency" or convention reasons (e.g. keep imdb_id, not imdbId or tconst; keep want_to_watch, not
      wantToWatch).</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="0. Scaffold supabase/ if absent">
      <item>Confirm whether supabase/config.toml exists. If not, initialize the local Supabase project
        structure so `supabase start` / `supabase db reset` work for verification later in this task.</item>
    </phase>

    <phase title="1. Migration: create_mvp_schema (DDL)">
      <item>Create supabase/migrations/&lt;YYYYMMDDHHMMSS&gt;_create_mvp_schema.sql using the current
        timestamp at creation time (do not reuse a placeholder timestamp).</item>
      <item>Define public.handle_updated_at() first (see ground_truth_db_notes).</item>
      <item>Create tables in this order, copying DDL verbatim from the cited schema doc sections, including
        every column, type, default, constraint and index exactly as written:
        media_items (2.1), genres + media_genres (2.2), people + media_people (2.2), platforms (3.1),
        catalog_snapshots (3.2), media_availability (3.3 DDL only — NOT the upsert/expire application logic),
        user_subscriptions (4), user_media_status (5), user_lists + list_items (6),
        imdb_import_batches + imdb_import_rows (7.1).</item>
      <item>Attach the updated_at trigger only to media_items, user_subscriptions, user_media_status,
        user_lists, exactly as shown in the doc.</item>
    </phase>

    <phase title="2. Migration: enable_rls_policies (RLS + grants)">
      <item>Create supabase/migrations/&lt;YYYYMMDDHHMMSS+1&gt;_enable_rls_policies.sql, timestamped after
        migration 1.</item>
      <item>Enable RLS on all 14 tables.</item>
      <item>Catalog group (media_items, genres, media_genres, people, media_people, platforms,
        catalog_snapshots, media_availability): one public SELECT policy per table (`using (true)`), no write
        policy, plus `grant select on public.&lt;table&gt; to anon, authenticated;` for each.</item>
      <item>Owner-only group with a direct user_id column (user_subscriptions, user_media_status,
        imdb_import_batches): apply the Section 9.1 "owner_all" pattern verbatim to each.</item>
      <item>imdb_import_rows: EXISTS-subquery owner-only policy joining to imdb_import_batches.user_id (see
        ground_truth_db_notes) — no public branch.</item>
      <item>user_lists + list_items: apply Section 9.2's SQL verbatim — select/insert/update/delete policies
        on user_lists, select/all policies on list_items, and the `grant select on public.user_lists,
        public.list_items to anon, authenticated;` statements.</item>
    </phase>

    <phase title="3. Local verification">
      <item>Start/reset a local Supabase instance and apply both migrations.</item>
      <item>Run information_schema checks confirming every table/column/constraint/index from Sections 2–7
        exists as specified.</item>
      <item>Confirm relrowsecurity = true for all 14 tables (pg_class / pg_tables).</item>
      <item>Create two test auth users (A and B). As user A: insert rows into user_subscriptions,
        user_media_status, imdb_import_batches (and a row in imdb_import_rows under that batch). As user B (and
        as anon), attempt to SELECT and UPDATE user A's rows in each of those four tables and confirm zero rows
        / permission denial.</item>
      <item>Create one user_lists row for user A with is_public = false and one with is_public = true, each
        with at least one list_items row. As anon and as user B, confirm the private list and its items return
        zero rows, and the public list and its items are fully readable.</item>
      <item>As anon and as an authenticated non-service user, confirm SELECT succeeds and INSERT/UPDATE/DELETE
        are denied on media_items, platforms, media_availability, catalog_snapshots, genres, people (and
        media_genres, media_people).</item>
      <item>Update a row in media_items, user_subscriptions, user_media_status and user_lists and confirm
        updated_at changes; confirm it does NOT exist as a column on the other 10 tables.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">All 14 tables (media_items, genres, media_genres, people, media_people, platforms,
      catalog_snapshots, media_availability, user_subscriptions, user_media_status, user_lists, list_items,
      imdb_import_batches, imdb_import_rows) exist with the exact columns, types, defaults, constraints and
      indexes from schema doc Sections 2–7. Verify via information_schema.columns / pg_indexes queries per
      table, diffed against the doc.</criterion>
    <criterion id="AC-2">RLS is enabled (relrowsecurity = true) on all 14 tables. Verify via
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace`.</criterion>
    <criterion id="AC-3">An authenticated user cannot read or write another user's rows in
      user_subscriptions, user_media_status, imdb_import_batches or imdb_import_rows. Verify with two real
      test accounts (A, B): rows created by A return zero rows and reject writes when queried/mutated as B.</criterion>
    <criterion id="AC-4">user_lists / list_items are readable without a session (anon) only when
      is_public = true; a private list returns zero rows both for anon and for a different authenticated user.
      Verify by querying as anon and as user B against a list owned by user A, both is_public states.</criterion>
    <criterion id="AC-5">media_items, platforms, media_availability, catalog_snapshots, genres, people (and
      the media_genres / media_people junction tables) are publicly readable (anon SELECT succeeds) and reject
      INSERT/UPDATE/DELETE from anon and from a regular authenticated (non-service-role) user. Verify by
      attempting each operation under both roles and confirming SELECT succeeds while writes are denied.</criterion>
    <criterion id="AC-6">updated_at auto-updates on media_items, user_subscriptions, user_media_status and
      user_lists after an UPDATE, via the public.handle_updated_at() trigger function. Verify by updating one
      row per table and comparing updated_at before/after.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT edit or delete any existing migration file — there are none yet, but if any exist by the time
      you run this, add a NEW timestamped file instead of touching them, per ARCHITECTURE.md.</item>
    <item>Do NOT rename any table or column from the exact names in specs/RIKUNA-PRD-schema-basedatos-rikuna.md
      Sections 2–7 (e.g. keep imdb_id, want_to_watch, is_stub, last_snapshot_id verbatim).</item>
    <item>Do NOT create seasons or episodes tables — explicitly out of MVP per Section 2.3.</item>
    <item>Do NOT implement the media_availability upsert/expire logic from Section 3.3, or the product queries
      from Section 8 — those are ingestion/query-layer work for other tickets (RIK-3, RIK-4, RIK-7, RIK-8), not
      DDL for this one.</item>
    <item>Do NOT create any types/, services/, actions/, ingestion/, hooks/, stores/ files or install any
      @supabase/* package — this ticket is database-only.</item>
    <item>Do NOT grant INSERT/UPDATE/DELETE to anon or authenticated on any catalog table — only SELECT.
      Service-role writes bypass RLS automatically and need no explicit grant.</item>
    <item>Do NOT add an updated_at column or trigger to any table other than media_items, user_subscriptions,
      user_media_status, user_lists.</item>
  </constraints>

  <out_of_scope>
    <item>seasons / episodes tables (Section 2.3 — explicitly not MVP).</item>
    <item>Catalog ingestion routines and the availability upsert/expire logic (Section 3.3) — RIK-3.</item>
    <item>IMDb CSV import processing logic (Section 7.3) — RIK-4 / RIK-5.</item>
    <item>Product queries (Section 8.1–8.3: "Qué ver este mes", discovery recommendations, "aún no visto") —
      RIK-7 / RIK-8.</item>
    <item>Auth routes, middleware, route guards — RIK-2.</item>
    <item>TypeScript types/, services/, actions/ layers — later tickets, once this schema exists.</item>
    <item>Seed or fixture data beyond what is strictly needed to create the two test auth users for RLS
      verification.</item>
    <item>Section 11 pending product/schema decisions (series catalog completeness, deep links per title,
      stub-enrichment process, watchlist-removal reconciliation policy, offer_type scope, public list slug
      global uniqueness) — flag these as follow-ups in the completion report; do not attempt to resolve them
      in this migration.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Use `gen_random_uuid()` for UUID defaults exactly as the doc specifies — confirm the pgcrypto/
      pgcrypto-equivalent extension is available in the target Postgres (Supabase enables this by default via
      `pgcrypto` or built-in `gen_random_uuid()` in Postgres 15+; no extra `create extension` statement should
      be needed on a standard Supabase project, but verify locally and add it only if `gen_random_uuid()`
      actually fails).</item>
    <item>Timestamp the two migration files with the actual completion time (YYYYMMDDHHMMSS), migration 2's
      timestamp strictly after migration 1's.</item>
    <item>When testing RLS as a specific user without a real HTTP session, use Postgres role/JWT claim
      simulation (e.g. `set local role authenticated; select set_config('request.jwt.claims',
      json_build_object('sub', '&lt;test-user-uuid&gt;')::text, true);`) or the Supabase CLI's local auth
      tooling — whichever is available in this environment — rather than skipping the live verification.</item>
  </implementation_notes>

  <deliverables>
    <item>supabase/migrations/&lt;timestamp&gt;_create_mvp_schema.sql</item>
    <item>supabase/migrations/&lt;timestamp+1&gt;_enable_rls_policies.sql</item>
    <item>supabase/config.toml if it had to be scaffolded</item>
    <item>Run `npm run lint` and fix any introduced issues (should be none — no TypeScript/JS touched).</item>
    <item>Persist documentation per completion_report/persistence below: one CHANGELOG.md bullet under
      [Unreleased] and one specs/logs/ file.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Two migration files (DDL then RLS) vs. one combined file — proceeding with two, matching the
      ticket's own two-part description. Confirm with the user before merging into one if preferred.</item>
    <item>handle_updated_at() implementation — proceeding with the standard minimal
      `new.updated_at = now(); return new;` version since the schema doc names but never defines it.</item>
    <item>media_genres / media_people RLS — proceeding by extending the documented catalog-group pattern to
      these two junction tables, since Section 9's table doesn't name them explicitly but they have no owner
      column.</item>
    <item>imdb_import_rows RLS — proceeding with an EXISTS-subquery owner-only policy against
      imdb_import_batches.user_id, since the table has no user_id column of its own and Section 9 gives no
      explicit SQL for it.</item>
    <item>Explicit anon/authenticated SELECT grants on all 8 catalog tables — proceeding with adding them
      explicitly (not just user_lists/list_items as literally shown in 9.2), to avoid depending on unverified
      default Supabase project grants.</item>
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
        <item>Format: `- RIK-1: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-1_database_schema_rls.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to database_schema_rls, matching specs/backlog/RIK-1_database_schema_rls.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-1_database_schema_rls.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: migration / types / services / actions / ingestion / features / components / routes — here it will be almost entirely "migration"), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-1 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a schema/config change uses the wrench emoji 🔧, unless this reads more like a new feature ✨ — pick whichever the mapping best supports).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables (e.g. "the database backing every other Rikuna screen is now in place"); a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a closing "Notes" line naming the deferred Section-11 items in plain language.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the streaming catalog and per-user watch data now have a real, secured home" instead of naming tables.</item>
      <item>No Screenshots section — this ticket has no user-visible UI.</item>
      <item>Keep it under 15 lines.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is Database/schema-only, so include ONLY a
        "## Prerequisites" section (local Supabase running, two test auth users created) and a
        "## Database validation" section with runnable, READ-ONLY SQL in fenced blocks — one query per
        acceptance criterion, using the real table/column names from this ticket, stating what each query
        should return (row presence/absence, relrowsecurity = true, permission-denied errors). Do not include a
        "## UI validation" section — there is none.</item>
      <item>End with "## Expected outcome" — 3-4 bullets tying back to AC-1 through AC-6.</item>
    </deliverable>
  </completion_report>
</task>
```

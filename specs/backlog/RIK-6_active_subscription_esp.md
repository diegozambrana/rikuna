# RIK-6 — Mis suscripciones

> Este documento es la versión en español, pensada como guía de lectura. La fuente de verdad es `specs/backlog/RIK-6_active_subscription.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

Los usuarios necesitan una pantalla `/suscripciones` donde declaren qué plataforma de streaming + país pagan actualmente, y donde puedan ver el historial completo de suscripciones pasadas. Esta es la fuente de datos de la que depende todo lo demás (panel, recomendaciones, cruce de disponibilidad) para saber "qué puede ver realmente este usuario ahora mismo". El ticket es solo CRUD + historial — sin estadísticas de aprovechamiento (eso es explícitamente Fase 2 según el PRD).

- Activar una nueva suscripción para una plataforma+país cierra automáticamente (`ended_on = hoy`) cualquier suscripción abierta previa para esa **misma** combinación plataforma+país.
- Un usuario puede tener más de una suscripción activa simultánea, siempre que sean combinaciones plataforma/país distintas (ej. Netflix·BO y Apple TV+·BO activas al mismo tiempo).
- La tabla de historial muestra todas las suscripciones pasadas con sus fechas, de más reciente a más antigua.
- Con cero suscripciones activas, este ticket solo tiene que garantizar que la capa de datos/acción subyacente se comporte correctamente (devuelve un resultado vacío, no lanza error) — el estado vacío propio del panel es responsabilidad de RIK-7.
- No existen comentarios del equipo más allá del texto del ticket pegado arriba — la descripción es la única fuente de alcance.

---

## Contexto

### Ticket original

**RIK-6 — Mis suscripciones**

**Descripción:** Vista `/suscripciones` para declarar el servicio de streaming activo (plataforma + país) y ver el historial de suscripciones anteriores, sobre la tabla `user_subscriptions` (modelo `started_on`/`ended_on`, sin estadísticas de aprovechamiento — eso es Fase 2).

**Criterios de aceptación:**

- Activar una nueva suscripción para una plataforma/país cierra automáticamente (`ended_on = hoy`) cualquier suscripción abierta previa para esa misma plataforma+país.
- Es posible tener más de una suscripción activa simultánea si son plataforma/país distintos.
- El historial muestra todas las suscripciones pasadas del usuario con sus fechas, ordenadas de más reciente a más antigua.
- Sin ninguna suscripción activa, el panel principal (RIK-7) muestra el estado vacío correspondiente en vez de fallar.

**Depende de:** RIK-1 (esquema/RLS), RIK-2 (autenticación + grupo de rutas `(app)`). Se asume que ambos ya aterrizaron antes de ejecutar este prompt; este documento no vuelve a derivar su esquema, solo lo referencia.

Ningún nombre de tabla en el texto del ticket usa un nombre informal que necesite remapeo — `user_subscriptions` ya es el nombre real según `RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 4.

### Comentarios del equipo

Ninguno. El ticket pegado (descripción + criterios de aceptación de arriba) es el único insumo; no hay discusión adicional del equipo que reconciliar.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| "Declarar el servicio de streaming activo (plataforma + país)" sugiere un selector simple | `user_subscriptions` no tiene columna `is_active` — la actividad se deriva de `ended_on is null`, y un **índice único parcial** (`user_subscriptions_active_uq` sobre `(user_id, platform_id, country) where ended_on is null`) impone como máximo una fila abierta por combinación plataforma+país a nivel de base de datos | El comportamiento "cerrar la previa, luego abrir la nueva" (AC-1) debe implementarse explícitamente en el código de la aplicación — Postgres rechazará un `insert` ingenuo con un error de clave duplicada si la fila anterior no se cierra primero, no la cierra automáticamente |
| El ticket asume que un selector plataforma/país simplemente funciona | No existe ninguna fila en `platforms` en ningún lugar del proyecto todavía — `supabase/migrations/` no existe, y no hay datos semilla ni migración de semilla en el repo | La fuente de datos del selector queda sin resolver; se marca como pregunta abierta abajo con un default recomendado (ver Decisiones tomadas #1) |
| El ticket referencia `user_subscriptions` directamente | La tabla no existe todavía — `supabase/migrations/` es un directorio ausente/vacío en el árbol actual | Este ticket está **bloqueado** por RIK-1; este prompt apunta al esquema que RIK-1 tiene especificado entregar (Sección 4 del PRD de esquema) y debe re-verificarse contra el archivo de migración real cuando RIK-1 se integre |
| El PRD de vistas (`RIKUNA-PRD-vistas-y-estilo-rikuna.md` Sección 1.3) especifica shadcn `"style": "lyra"` | El `components.json` real del repo tiene `"style": "base-lyra"` (la variante Base UI — el proyecto migró de Radix, según `AGENTS.md`) | Cualquier componente shadcn agregado para esta pantalla (Select/Combobox, Table, Card, Form, Input) debe instalarse para el estilo `base-lyra`, no la instrucción literal `lyra` del PRD |

### Estado actual en la base de datos

`user_subscriptions` no existe todavía en este proyecto — `supabase/migrations/` está ausente. El DDL de abajo es lo que RIK-1 tiene especificado entregar (`RIKUNA-PRD-schema-basedatos-rikuna.md`, Sección 4) y es la verdad de referencia sobre la que se construye este ticket, **pendiente de re-verificación contra el archivo de migración real cuando RIK-1 se integre**:

```sql
create table if not exists public.user_subscriptions (
    id          uuid default gen_random_uuid() not null primary key,
    created_at  timestamptz default now() not null,
    updated_at  timestamptz default now() not null,
    user_id     uuid not null references auth.users(id) on delete cascade,
    platform_id uuid not null references public.platforms(id) on delete restrict,
    country     varchar(2) not null,
    started_on  date not null default current_date,
    ended_on    date,                              -- null = activa/abierta
    notes       text
);

create unique index if not exists user_subscriptions_active_uq
    on public.user_subscriptions (user_id, platform_id, country)
    where ended_on is null;

create index if not exists user_subscriptions_active_idx
    on public.user_subscriptions (user_id) where ended_on is null;
```

- **RLS**: solo el dueño para lectura y escritura (`auth.uid() = user_id`), según Sección 9 del PRD de esquema — entregado por RIK-1, no por este ticket.
- **`platforms`** (referenciada por FK, también entregada por RIK-1):

```sql
create table if not exists public.platforms (
    id                uuid default gen_random_uuid() not null primary key,
    name              varchar not null,
    slug              varchar not null unique,
    logo_url          text,
    provider_id_movie integer,
    provider_id_tv    integer
);
```

- **Uso en código**: ninguno todavía — no existen carpetas `types/`, `services/`, `actions/`, `features/`. Este ticket es terreno virgen para la vertical de suscripciones.

### Lógica actual (suscripciones)

No existe lógica actual — no hay `services/SubscriptionServices`, ni `actions/subscriptions`, ni `features/subscriptions`, ni ruta `app/(app)/suscripciones`. `ARCHITECTURE.md` ya nombra las formas objetivo (servicio `SubscriptionServices`, carpeta de acciones `subscriptions` — "Activate/close `user_subscriptions`", feature `subscriptions` — "Active subscription card, history table, activate form"), así que este ticket llena una vertical que el documento de arquitectura ya reservó, en vez de inventar un patrón nuevo.

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Plataforma (selector) | FK a `platforms.id` | `user_subscriptions.platform_id` (uuid, not null, `on delete restrict`) | ya existe (reutilizar) — leer filas en vivo desde `platforms`, no hardcodear |
| País (selector) | ISO-3166 alpha-2 | `user_subscriptions.country` (`varchar(2)`, not null) | ya existe (reutilizar) — no existe ninguna lista canónica de países en el proyecto; debe crearse (ver Decisiones tomadas #3) |
| Fecha de inicio | date | `started_on` (`date not null default current_date`) | ya existe (reutilizar) |
| Fecha de cierre | date, nullable | `ended_on` (`date`, nullable = activa) | ya existe (reutilizar) |
| Notas (opcional, no está en el AC pero está en el esquema) | text | `notes` | ya existe (reutilizar) — exponer como campo opcional, ningún AC lo requiere |
| Flag "suscripción activa" | n/a | derivado, no es una columna | redundante — cubierto por `ended_on is null`, no agregar una columna `is_active` |

### Archivos impactados

**Types**
- `types/UserSubscription.ts` (o una entrada en el barrel `types/index.ts`) — debe crearse; refleja las seis columnas de arriba.

**Services**
- `services/SubscriptionServices/index.ts` — debe crearse. Métodos: `getActiveSubscriptions(userId)`, `getSubscriptionHistory(userId)`, `activateSubscription(input)`. Centraliza la forma de la consulta de cerrar-luego-insertar.

**Actions**
- `actions/subscriptions/index.ts` (`"use server"`) — debe crearse. Verificación de sesión vía `supabase.auth.getUser()`, delega a `SubscriptionServices` con el cliente ligado a la petición, llama a `revalidatePath` en `/suscripciones` y `/panel` tras activar.

**Features**
- `features/subscriptions/` — debe crearse: visualización de suscripciones activas, tabla de historial, formulario de activación (selector de plataforma + país).

**Components**
- `components/ui/` actualmente solo tiene `button.tsx`. `Select`/`Combobox`, `Table`, `Card`, `Form`, `Input`, `Label` referenciados por el PRD de vistas para esta pantalla no están instalados todavía — deben agregarse vía el CLI de shadcn para el estilo `base-lyra` antes de que los componentes de la feature puedan usarlos.

**Rutas de la app**
- `app/(app)/suscripciones/page.tsx` — debe crearse. Depende de que RIK-2 haya entregado el grupo de rutas `(app)` y su `AuthCheck`/`UserProvider`; verificar que ese layout exista antes de agregar esta página.

**Constants**
- `constants/countries.ts` — debe crearse (ver Decisiones tomadas #3); no hay ninguna lista de países que reutilizar.

**Migraciones**
- Ninguna para este ticket. `user_subscriptions` y `platforms` son entregadas íntegramente por RIK-1; este ticket no debe agregar ni alterar una migración.

**Tests**
- No hay ningún test runner configurado en `package.json` (sin `jest`/`vitest`/`playwright`). No hay fixtures existentes que romper. Se recomienda posponer los tests automatizados hasta que se elija un runner a nivel de proyecto; este ticket se apoya en la guía de validación manual del reporte de finalización en su lugar.

### Decisiones tomadas

1. **Fuente de datos de referencia plataforma/país** — `platforms` no tiene datos semilla ni migración de semilla en ningún lugar del repo. Default recomendado (sin confirmar): este ticket lee las filas que existan en `platforms` en tiempo de ejecución y muestra un estado vacío explícito en el formulario de activación ("No hay plataformas configuradas todavía") cuando la tabla tiene cero filas, en vez de hardcodear una lista de plataformas. Poblar `platforms` (vía la ingesta de RIK-3 o una migración de semilla manual) queda fuera del alcance de este ticket.
2. **Estrategia de cerrar-luego-insertar para AC-1** — Default recomendado (sin confirmar): implementarlo como dos llamadas secuenciales `await` a Supabase dentro de `SubscriptionServices.activateSubscription` (actualizar la fila abierta existente para ese platform_id+country exacto a `ended_on = current_date`, luego insertar la fila nueva), en vez de introducir una nueva función/RPC de Postgres. Esto mantiene el ticket dentro del esquema entregado por RIK-1 (sin migración nueva) a costa de no ser una transacción atómica única; se agrega un catch defensivo para un `23505` (unique_violation) por si hay una condición de carrera. Si se requiere mayor atomicidad más adelante, un ticket de seguimiento puede introducir una función de base de datos.
3. **Lista de países para el selector** — Default recomendado (sin confirmar): un `constants/countries.ts` curado y pequeño (código ISO-3166 alpha-2 → nombre para mostrar), no una librería i18n completa. Empezar con los mercados que Rikuna realmente apunta y mantenerlo fácil de extender.
4. **Orden del historial** — Default recomendado (sin confirmar, pero se deriva directamente de la redacción de AC-3): ordenar por `started_on desc`.
5. **Store de estado del cliente** — Default recomendado (sin confirmar): sin store de Zustand para esta feature. El formulario de activación no tiene estado de filtro/UI del lado del cliente que persistir más allá de los propios campos del formulario, y la tabla de historial no tiene filtrado del lado del cliente en el alcance, así que un store sería ceremonia sin uso. Revisar solo si RIK-7 o un ticket posterior necesita estado de suscripciones compartido entre features.

### Fuera de alcance

- Estadísticas de aprovechamiento de suscripción ("estadística de aprovechamiento") — explícitamente Fase 2 según `RIKUNA-PRD-documento-especificacion-rikuna.md` Sección 12 y reiterado en la descripción del ticket.
- Poblar o administrar `platforms` (sin UI de administración de plataformas) — este ticket solo lee filas existentes.
- El estado vacío propio del panel de RIK-7 — este ticket solo garantiza que la capa de datos/acción de suscripciones subyacente se comporte correctamente (arreglo vacío, no un error) cuando un usuario no tiene suscripción activa.
- Tests automatizados — no hay ningún test runner configurado a nivel de proyecto todavía.
- Una función/RPC de Postgres para cerrar-luego-insertar de forma atómica — pospuesto según la Decisión #2.

---

## Plan de implementación

**Objetivo**: Dar a los usuarios una pantalla `/suscripciones` funcional respaldada por `user_subscriptions` (entregada por RIK-1) que pueda activar una suscripción plataforma+país (cerrando automáticamente cualquier previa abierta para esa combinación exacta), listar todas las suscripciones activas actuales, y listar el historial completo de más reciente a más antigua — con comportamiento correcto (sin lanzar error, resultado vacío) cuando el usuario no tiene ninguna.

**En alcance**
1. `types/UserSubscription.ts` (o entrada en `types/index.ts`) que refleje las columnas reales de `user_subscriptions`.
2. `services/SubscriptionServices/index.ts`: `getActiveSubscriptions`, `getSubscriptionHistory`, `activateSubscription` (cerrar-luego-insertar según Decisión #2).
3. `actions/subscriptions/index.ts`: acción(es) `"use server"` que envuelven el servicio con verificación de sesión y `revalidatePath('/suscripciones')` + `revalidatePath('/panel')`.
4. Agregar las primitivas shadcn `base-lyra` faltantes necesarias para la pantalla (Select/Combobox, Table, Card, Form, Input, Label) si no están ya presentes.
5. `features/subscriptions/`: formulario de activación (plataforma + país), visualización de suscripciones activas, tabla de historial.
6. `constants/countries.ts`: lista curada de países para el selector.
7. `app/(app)/suscripciones/page.tsx`: componente de servidor que conecta actions/services con los componentes de la feature.

**Fuera de alcance**
- Estadísticas/aprovechamiento (Fase 2).
- Poblado de plataformas/UI de administración.
- El estado vacío propio de RIK-7 (solo el comportamiento seguro-ante-vacío de la capa de datos es responsabilidad de este ticket).
- Tests automatizados (sin runner configurado).

**Riesgos clave / compatibilidad**
- El índice único parcial implica que una implementación de solo-insertar ingenua lanzará error en la segunda activación para la misma plataforma+país — el método de servicio de la fase 2 debe cerrar-luego-insertar, no solo insertar.
- `platforms` puede legítimamente tener cero filas al momento en que este ticket se lance (el poblado de RIK-3 es una dependencia separada y sin orden garantizado) — la UI debe degradarse a un estado vacío, no fallar.
- No importar `lib/supabase/admin.ts` aquí — este es un flujo normal orientado al usuario, gobernado por RLS (según `ARCHITECTURE.md`, `admin.ts` es exclusivo de `ingestion/`).

**Mapeo de criterios de aceptación**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | `SubscriptionServices.activateSubscription` cierra la fila abierta coincidente (`ended_on = current_date`) para el mismo `platform_id` + `country` antes de insertar la fila nueva |
| AC-2 | El índice único parcial solo restringe una fila abierta **por plataforma+país**; activar una plataforma o país distinto es un simple insert y coexiste con otras filas abiertas |
| AC-3 | `SubscriptionServices.getSubscriptionHistory` ordena por `started_on desc` |
| AC-4 | `SubscriptionServices.getActiveSubscriptions` devuelve `[]` (no un error/excepción) cuando el usuario no tiene suscripciones abiertas, para que RIK-7 pueda ramificar sobre un arreglo vacío |

---

## Prompt para Claude Code

```xml
<task id="RIK-6" title="Mis suscripciones" depends_on="RIK-1,RIK-2">
  <role>
    Senior full-stack engineer on Rikuna (Next.js 16 App Router + React 19 + Supabase). You follow the
    project's layered + feature-sliced architecture strictly and never take shortcuts across layer
    boundaries (routes never call Supabase directly, actions never bypass services, ingestion's
    service-role client never leaks into user-facing code).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, auth boundaries, ingestion vs user actions, the reserved shapes for SubscriptionServices/actions/subscriptions/features/subscriptions.</item>
    <item>AGENTS.md — this is Next.js 16, not the Next.js you trained on; read the relevant guide under node_modules/next/dist/docs/ (resolved relative to AGENTS.md's own directory) before writing any Server Action, form, or route-group code. Pay special attention to node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md (Server Functions/Actions, revalidatePath) and node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md.</item>
    <item>.cursor/commands/makecommit.md — commit format and emoji mapping needed for the commit_message deliverable.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 4 (user_subscriptions DDL, the active-subscription business rule) and Section 3.1 (platforms).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 1.3/1.5 (design system, component-per-need mapping) and Section 2.2 (/suscripciones screen content).</item>
    <item>components.json — confirm the real shadcn style/baseColor before adding any UI primitive.</item>
    <item>components/ui/button.tsx — the only existing shadcn primitive today; matches its conventions for any new primitive you add.</item>
    <item>lib/utils.ts — the cn() helper used across the project.</item>
    <item>app/layout.tsx and app/globals.css — root layout, fonts, theme tokens the new screen must inherit.</item>
    <item>The latest migration(s) in supabase/migrations/ that create user_subscriptions and platforms (delivered by RIK-1) — confirm real column names/types/constraints match this document before writing any query; if they differ, follow the real migration, not this document.</item>
    <item>CHANGELOG.md — format and where to append the new entry.</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna is a personal streaming-rotation planner. Users declare which platform(s) + country they
    currently pay for so the app can cross-reference their watchlist against real availability. This
    ticket delivers the /suscripciones screen: an activation form (platform + country) and a history
    table, on top of the user_subscriptions table delivered by RIK-1. No table/column in this ticket is
    new — everything already exists in RIK-1's schema. What is genuinely new is the application-level
    logic that makes "activating closes the prior open row for that exact platform+country" true, since
    the database only prevents two simultaneously-open rows for the same pair — it does not auto-close
    anything.
  </context>

  <ground_truth_db_notes critical="true">
    <note>Real table is public.user_subscriptions (already correct in the ticket text) with columns: id, created_at, updated_at, user_id, platform_id, country (varchar(2)), started_on (date, default current_date), ended_on (date, nullable), notes (text, nullable). There is NO is_active boolean column — "active" always means ended_on is null.</note>
    <note>A partial unique index user_subscriptions_active_uq exists on (user_id, platform_id, country) where ended_on is null. This means: (a) Postgres itself blocks two simultaneously-open rows for the same user+platform+country, raising a 23505 unique_violation if you try; (b) it does NOT automatically close an old row when you insert a new one for the same pair — your service code must explicitly UPDATE the existing open row (set ended_on = current_date) for that exact platform_id + country BEFORE inserting the new row.</note>
    <note>Only close the row matching the SAME platform_id and country as the one being activated. Do not close other open subscriptions for different platforms/countries — AC-2 requires those to coexist.</note>
    <note>platforms (public.platforms: id, name, slug, logo_url, provider_id_movie, provider_id_tv) currently has no seed data anywhere in this repo. Do not hardcode a platform list in the picker — query platforms live, and render an explicit empty state on the form if it returns zero rows.</note>
    <note>RLS on user_subscriptions is owner-only (auth.uid() = user_id) for both read and write, delivered by RIK-1. Use the request-scoped Supabase client (createClient() from lib/supabase/server, the same one the session check used) so Postgres enforces isolation — do not add an application-level extra WHERE user_id = ... as a substitute for RLS, but it is fine to pass user_id explicitly when it is required for the query shape (e.g. matching rows to close).</note>
    <note>components.json has "style": "base-lyra" (the Base UI variant), not the plain "lyra" that RIKUNA-PRD-vistas-y-estilo-rikuna.md's Section 1.3 snippet shows — that PRD snippet is stale relative to the actual project. Add any new shadcn primitive (Select or Combobox, Table, Card, Form, Input, Label) using the project's real base-lyra style.</note>
    <note>No supabase/migrations directory may exist yet if RIK-1 has not merged — if so, this task is blocked; do not fabricate the schema, stop and report the blocker instead of guessing column names.</note>
    <note>No app/(app)/ route group may exist yet if RIK-2 has not merged — if so, this task is blocked on the auth guard/layout; do not add app/(app)/suscripciones/page.tsx without the group's layout.tsx (AuthCheck + UserProvider) already in place.</note>
  </ground_truth_db_notes>

  <story>
    As a Rikuna user, I want to declare which streaming platform(s) and country I currently pay for, and
    see the history of past subscriptions, so the rest of the app can tell me what I can actually watch
    right now.
  </story>

  <requirements>
    <phase title="1. Types">
      <item>Create types/UserSubscription.ts (or add to types/index.ts barrel, matching how other domains in the barrel are structured once they exist) with a UserSubscription type mirroring the real columns: id, createdAt, updatedAt, userId, platformId, country, startedOn, endedOn, notes — plus whatever camelCase mapping convention the rest of the barrel uses.</item>
      <item>Add an input type for activation, e.g. ActivateSubscriptionInput { platformId: string; country: string; notes?: string }.</item>
    </phase>

    <phase title="2. Services">
      <item>Create services/SubscriptionServices/index.ts exporting a SubscriptionServices class that receives a SupabaseClient in its constructor (dependency injection, per ARCHITECTURE.md — no cookies()/auth checks/revalidatePath here).</item>
      <item>getActiveSubscriptions(userId): select all rows where user_id = userId and ended_on is null. Must return an empty array, never throw, when there are none.</item>
      <item>getSubscriptionHistory(userId): select all rows where user_id = userId, ordered by started_on desc. This includes both active and closed rows (the "historial" per the vistas PRD's /suscripciones content shows the active card separately AND a full history table).</item>
      <item>activateSubscription(userId, input: ActivateSubscriptionInput): (a) update any row where user_id = userId, platform_id = input.platformId, country = input.country, and ended_on is null, setting ended_on = current date; (b) insert a new row with user_id, platform_id, country, notes, started_on defaulting to today. Wrap step (b) with a defensive catch for a 23505 unique_violation (in case of a race) and surface a clear error to the caller rather than a raw Postgres error.</item>
      <item>getKnownPlatforms(): thin passthrough select against platforms (id, name, slug) ordered by name — used to populate the picker. Keep this on SubscriptionServices since it's only consumed by this feature's form; do not create a full MediaServices-style platform catalog service for this ticket.</item>
    </phase>

    <phase title="3. Actions">
      <item>Create actions/subscriptions/index.ts with "use server" at the top.</item>
      <item>getActiveSubscriptionsAction() / getSubscriptionHistoryAction() / getKnownPlatformsAction(): verify session via supabase.auth.getUser(), redirect or throw if unauthenticated (match RIK-2's established pattern once it exists), then delegate to SubscriptionServices instantiated with the same request-scoped client.</item>
      <item>activateSubscriptionAction(formData: FormData) (or a typed input, matching whatever form-submission pattern node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md recommends for this Next.js version): verify session, parse/validate platformId and country, call SubscriptionServices.activateSubscription, then revalidatePath('/suscripciones') and revalidatePath('/panel') (the panel's "active service" header depends on this data per ARCHITECTURE.md's Server Actions responsibilities).</item>
    </phase>

    <phase title="4. Shared UI primitives">
      <item>Check components/ui/ for Select or Combobox, Table, Card, Form, Input, Label. Add any missing ones via the shadcn CLI using this project's real style (base-lyra) and baseColor (mist) from components.json — do not hand-roll a component that the CLI already provides for this style.</item>
    </phase>

    <phase title="5. Features">
      <item>Create features/subscriptions/ with: an activation form component (platform picker + country picker + submit, calling activateSubscriptionAction, with pending/error UI per the Next.js docs' recommended pattern for this version), an active-subscriptions display (one Card per open subscription — plural, since AC-2 allows more than one), and a history table (using the Table/DataTable primitive) ordered newest first.</item>
      <item>Create constants/countries.ts: a small curated array of { code: string; name: string } (ISO-3166 alpha-2) covering at minimum Rikuna's initial target market(s); keep it easy to extend. Do not attempt a full i18n country list.</item>
      <item>If platforms is empty, the activation form must render a clear empty-state message instead of a broken/empty picker (e.g. "No hay plataformas configuradas todavía").</item>
    </phase>

    <phase title="6. Route">
      <item>Create app/(app)/suscripciones/page.tsx as a Server Component: fetch active subscriptions, history, and known platforms via the actions from phase 3, and pass them as initial data into the feature components from phase 5, per the Server-Component-fetches/Client-feature-receives-props pattern in ARCHITECTURE.md's Features section.</item>
      <item>Confirm the page sits under the existing app/(app)/ route group layout (AuthCheck + UserProvider) delivered by RIK-2 — do not duplicate a session check at the page level beyond what the shared layout already does, only what the actions require per-call.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Activating a subscription for a platform+country that already has an open row for that same user closes the old row (ended_on set to today's date) before/at the same time the new row is inserted. Verify with a SQL check: select id, started_on, ended_on from user_subscriptions where user_id = :uid and platform_id = :pid and country = :country order by started_on desc — the previously-open row must now show a non-null ended_on equal to today, and exactly one row for that triple has ended_on is null.</criterion>
    <criterion id="AC-2">A user can have simultaneous open subscriptions for different platform/country pairs. Verify by activating two different platform_id or country combinations for the same user and confirming both appear in getActiveSubscriptions()/the UI's active-subscriptions display, and that select count(*) from user_subscriptions where user_id = :uid and ended_on is null returns 2 (or more) after activating distinct pairs.</criterion>
    <criterion id="AC-3">The history table shows all past subscriptions for the user ordered newest to oldest by started_on. Verify by activating three subscriptions with distinct started_on values (or across distinct platform/country pairs) and confirming the UI table and the getSubscriptionHistory() query both return them in descending started_on order.</criterion>
    <criterion id="AC-4">getActiveSubscriptions() (and the /suscripciones page it feeds) returns an empty array — not an exception, not a Postgres error, not undefined — for a user with zero open subscriptions. Verify with a fresh test user that has never activated a subscription: the action resolves to [] and the page renders without a 500 or unhandled error.</criterion>
    <criterion id="AC-5">activateSubscription only closes rows matching the exact platform_id + country being activated; it must not close open subscriptions the user has for other platforms/countries. Verify: with two pre-existing open subscriptions (different platform/country), activating a third distinct pair leaves the first two still open (ended_on is null) in user_subscriptions.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create or modify a supabase/migrations file for this ticket — user_subscriptions and platforms are fully delivered by RIK-1; if the real migration differs from this document's DDL, follow the real migration and note the discrepancy in the verification report, do not "fix" the schema yourself.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere in actions/subscriptions or services/SubscriptionServices — this is a normal user-facing, RLS-governed flow, not ingestion.</item>
    <item>Do NOT add an is_active or similar computed boolean column anywhere — "active" is always derived from ended_on is null.</item>
    <item>Do NOT hardcode a list of platforms in the picker or anywhere in features/subscriptions — always read live from the platforms table.</item>
    <item>Do NOT implement subscription-utilization statistics, charts, or "aprovechamiento" calculations — Fase 2, explicitly out of scope.</item>
    <item>Do NOT build a platforms admin/seeding UI — if platforms has zero rows, render the empty state described in phase 5 and stop there.</item>
    <item>Do NOT touch RIK-7's /panel empty-state rendering — only ensure the data this ticket owns behaves correctly (empty array) so RIK-7 can consume it safely later.</item>
    <item>Do NOT rename existing columns (user_id, platform_id, country, started_on, ended_on, notes) in any type, service, or query.</item>
  </constraints>

  <out_of_scope>
    <item>Subscription-utilization statistics ("estadística de aprovechamiento") — Fase 2 per the product spec.</item>
    <item>Seeding platforms or any platform-onboarding admin UI.</item>
    <item>RIK-7's panel empty-state UI itself.</item>
    <item>Automated tests — no test runner is configured in package.json yet for this project.</item>
    <item>A Postgres RPC/transaction function for atomic close-then-insert (two sequential Supabase calls is the accepted approach for this ticket; note the tradeoff in the verification report).</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/SubscriptionServices/index.ts — class SubscriptionServices { constructor(private supabase: SupabaseClient) {}; getActiveSubscriptions(userId: string): Promise&lt;UserSubscription[]&gt;; getSubscriptionHistory(userId: string): Promise&lt;UserSubscription[]&gt;; activateSubscription(userId: string, input: ActivateSubscriptionInput): Promise&lt;UserSubscription&gt;; getKnownPlatforms(): Promise&lt;Pick&lt;Platform, "id" | "name" | "slug"&gt;[]&gt;; }</item>
    <item>actions/subscriptions/index.ts — "use server"; export async function activateSubscriptionAction(...), getActiveSubscriptionsAction(), getSubscriptionHistoryAction(), getKnownPlatformsAction(); each verifies supabase.auth.getUser() first.</item>
    <item>app/(app)/suscripciones/page.tsx — Server Component, no "use client"; calls the actions above directly (Server Components can call Server Functions directly without a network round trip) and passes results as props to features/subscriptions components.</item>
    <item>features/subscriptions/ suggested files: ActivateSubscriptionForm.tsx (client, uses the Server Action as its form action), ActiveSubscriptionsList.tsx, SubscriptionHistoryTable.tsx.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created or modified as needed.</item>
    <item>Run npm run lint and fix any issues introduced by this change.</item>
    <item>Persist documentation per completion_report/persistence below: one CHANGELOG.md bullet under [Unreleased], one specs/logs/ file.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Platforms seed data source is undecided — proceeding with the default: read live from platforms, render an empty state if it has zero rows, and do not seed it in this ticket.</item>
    <item>Close-then-insert atomicity is undecided — proceeding with the default: two sequential Supabase calls in the service layer (no new RPC/migration), with a defensive catch on 23505.</item>
    <item>Country list source is undecided — proceeding with the default: a small curated constants/countries.ts, not a full i18n library.</item>
    <item>Whether a Zustand store is needed is undecided — proceeding with the default: no store for this feature, plain Server Action + props.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-5): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-6: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-6_active_subscription.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-6_active_subscription.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / actions / features / components / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-6 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section (this ticket has user-visible UI); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the subscription screen" or "the streaming service picker" instead of naming components or tables.</item>
      <item>Keep the core comment under 15 lines (excluding Screenshots).</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing.</item>
      <item>Screenshots — list 1–4 items, each: screen/area name, auth state, and what it should show. Suggested: (1) /suscripciones logged in with no active subscription — empty active-subscription state and empty history; (2) /suscripciones after activating a first platform+country — active card and the picker; (3) /suscripciones after activating a second platform+country for a different pair — two simultaneous active subscriptions; (4) /suscripciones history table after replacing a subscription — showing the closed prior row and the new open one. Prefix each with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is Mixed UI + Database — include both "## UI validation" and "## Database validation" sections.</item>
      <item>"## Prerequisites": dev server running (npm run dev), a logged-in test user (RIK-2), at least one row in platforms (state plainly if none exist and what that means for testing — the empty state is itself testable).</item>
      <item>"## UI validation": numbered steps at /suscripciones — activate a first platform+country, confirm it appears as active; activate the same platform+country again, confirm the old one moves to history with today's end date and the active card still shows exactly one open row for that pair; activate a different platform or country, confirm both are now shown as active simultaneously; check the history table is ordered newest first.</item>
      <item>"## Database validation": read-only SQL against user_subscriptions — select user_id, platform_id, country, started_on, ended_on from user_subscriptions where user_id = :uid order by started_on desc; confirm the partial-unique-index invariant holds (at most one null ended_on per platform_id+country per user).</item>
      <item>"## Expected outcome": 1–3 bullets tying back to AC-1 through AC-5.</item>
    </deliverable>
  </completion_report>
</task>
```

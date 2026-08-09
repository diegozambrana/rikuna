# RIK-10 — Mis listas

> Documento de lectura en español. La fuente de verdad es `specs/backlog/RIK-10_user_lists_management.md` (inglés) — ante cualquier diferencia, ese archivo manda.

## Resumen del ticket

Un usuario con sesión iniciada necesita control total y autoservicio sobre sus propias listas curadas de títulos: crear una lista, renombrarla, eliminarla, agregar o quitar títulos (tanto desde la lista como desde la ficha de un título), reordenar títulos dentro de una lista, y alternar una lista entre privada y pública. Este ticket entrega las pantallas del **lado del dueño** (`/mis-listas`, `/mis-listas/[slug]`) y todas las mutaciones detrás de ellas, sobre las tablas `user_lists` / `list_items` que crea RIK-1.

- Crear, renombrar, eliminar una lista; agregar/quitar títulos desde la pantalla de detalle de la lista y desde la ficha de título.
- Alternar un `Switch` en `/mis-listas/[slug]` cambia `user_lists.is_public`; el toggle y su persistencia son responsabilidad de este ticket — la página pública real que renderiza el enlace compartido es de RIK-11.
- Arrastrar para reordenar títulos dentro de una lista persiste `list_items.sort_order` y sobrevive a una recarga.
- El RLS (ya definido por RIK-1) debe impedir que un usuario vea o edite listas privadas de otro usuario — este ticket no debe introducir un bypass a nivel de aplicación (por ejemplo, nunca usar `lib/supabase/admin.ts` aquí).
- No se recibieron comentarios adicionales del equipo para esta corrida — la descripción y los criterios de aceptación son el alcance completo.

---

## Contexto

### Ticket original

**RIK-10 — Mis listas**

**Descripción:** Gestión libre de listas propias: `/mis-listas` (listado con nombre, cantidad de títulos, badge de visibilidad, crear nueva) y `/mis-listas/[slug]` (detalle con títulos, reordenamiento, cambio de visibilidad y copiar enlace si es pública), sobre `user_lists`/`list_items`.

**Criterios de aceptación:**
- Un usuario puede crear, renombrar, eliminar una lista, y agregar/quitar títulos (desde la lista o desde la ficha de título).
- Cambiar el switch de visibilidad de una lista a pública genera de inmediato un enlace compartible funcional (implementado end-to-end en RIK-11, pero el toggle y la persistencia de `is_public` son de este ticket); cambiarla a privada invalida el acceso público en la siguiente carga.
- Reordenar títulos dentro de una lista persiste el `sort_order` y se refleja tras recargar.
- Un usuario no puede ver ni editar listas de otro usuario que no sean públicas (verificar con dos cuentas).

**Depende de:** RIK-1 (`Esquema de base de datos y RLS`), RIK-2 (`Autenticación y estructura de rutas`), RIK-9 (`Ficha de título y marcado manual`). **Bloquea a:** RIK-11 (`Lista pública`).

Al momento de este análisis, ninguno de RIK-1, RIK-2, RIK-9 ha aterrizado — `supabase/migrations/`, `types/`, `services/`, `actions/`, `features/`, `app/(app)/` todavía no existen en este repositorio. Este documento asume que las tres dependencias aterrizan primero, tal como se describe en el PRD de esquema (`specs/RIKUNA-PRD-schema-basedatos-rikuna.md`, Sección 6 y 9.2) y no re-deriva nada — el agente que ejecute el prompt de abajo debe re-verificar el archivo de migración real antes de escribir código (ver las notas de verdad de base de datos dentro del prompt).

### Comentarios del equipo

No se recibieron comentarios del tracker para esta corrida. Sí se recibieron dos notas de frontera directamente de quien encargó el ticket (no del tracker), que se tratan como restricciones de alcance autoritativas y se incorporan en `<constraints>` y `<out_of_scope>` del prompt:

1. `user_lists.slug` es único **solo por usuario** (`user_lists_user_slug_uq`), no globalmente. La propia sección "Pendientes" del PRD de esquema (11.6) señala esto y recomienda que el enlace público use un **código corto propio, único a nivel global**, en vez del `slug` interno, específicamente para evitar colisiones entre usuarios cuando se abra la etapa multiusuario (Fase 3).
2. RIK-10 (este ticket) sigue usando el `slug` interno por usuario para las rutas propias del dueño en `/mis-listas/[slug]`. El código público separado (¿columna nueva o tabla nueva? — sin decidir) es responsabilidad de **RIK-11**. Este ticket debe exponer la funcionalidad de "copiar enlace" como un punto de interfaz delgado — un helper `getPublicListUrl(list)` — en vez de inventar el mecanismo del código público, para que los dos tickets compongan sin chocar en el mismo archivo.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| El ticket sugiere que el enlace público se "genera de inmediato" al activar el toggle | Sección 11.6 del PRD de esquema: el `slug` interno es único solo por usuario; no existe aún columna/tabla de código público global, e inventar una aquí colisionaría con la decisión de diseño de RIK-11 | Este ticket NO debe construir el enlace compartible real. Persiste `is_public` y renderiza el toggle/botón a través de un stub `getPublicListUrl(list)` que devuelve un placeholder hasta que RIK-11 lo implemente |
| El ticket referencia `user_lists`/`list_items` como si ya estuvieran migradas | `supabase/migrations/` todavía no existe en este repositorio; el DDL solo existe en `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 6 | El agente debe releer la migración realmente aterrizada (de RIK-1) antes de escribir queries — los nombres/casing de columnas aquí provienen del PRD, no de código verificado |
| El ticket no menciona qué variante del kit de UI usar | `components.json` muestra `"style": "base-lyra"` con `@base-ui/react` en `package.json` — el proyecto migró de Radix a Base UI, aunque ambos documentos PRD (`vistas-y-estilo-rikuna.md` Sección 1.3, `documento-especificacion...`) describen el `"lyra"` plano (basado en Radix) | Todos los primitivos shadcn nuevos (`Dialog`, `Switch`, `Tooltip`) deben agregarse en el estilo `base-lyra`; no copiar código con sabor Radix de los ejemplos del PRD |
| El ticket no dice cómo se agrega un título a una lista desde el lado de la lista vs. el lado del título | El PRD (`vistas-y-estilo-rikuna.md` 1.5, 2.2) muestra dos puntos de entrada de UX distintos: un `Dialog`/`Popover` con checkboxes desde la ficha de título, y una grilla reordenable con agregar/quitar implícito desde el detalle de la lista | Se necesitan dos piezas de UI distintas que comparten las mismas dos Server Actions (`addListItem` / `removeListItem`) — detallado en el plan de implementación |

### Estado actual en la base de datos

Según `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sección 6 (la migración en sí todavía no existe en este repositorio — re-verificar contra el archivo real una vez que aterrice RIK-1):

```sql
create table if not exists public.user_lists (
    id          uuid        default gen_random_uuid() not null primary key,
    created_at  timestamptz default now() not null,
    updated_at  timestamptz default now() not null,
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        varchar not null,
    slug        varchar not null,
    description text,
    is_public   boolean default false not null,
    constraint user_lists_user_slug_uq unique (user_id, slug)
);

create table if not exists public.list_items (
    id         uuid default gen_random_uuid() not null primary key,
    created_at timestamptz default now() not null,
    list_id    uuid not null references public.user_lists(id) on delete cascade,
    media_id   uuid not null references public.media_items(id) on delete cascade,
    sort_order integer default 0 not null,
    note       text,
    constraint list_items_uq unique (list_id, media_id)
);
create index if not exists list_items_list_idx on public.list_items (list_id, sort_order);
```

RLS (Sección 9.2 — "el caso mixto público/privado"):

- `user_lists_select`: `using (is_public or auth.uid() = user_id)` — filas públicas legibles por cualquiera (incluido `anon`), filas privadas solo por el dueño.
- `user_lists_write` / `user_lists_update` / `user_lists_delete`: todas condicionadas a `auth.uid() = user_id`.
- `list_items_select`: hereda la visibilidad del padre vía una subconsulta `exists` sobre `user_lists`.
- `list_items_write` (todas las operaciones): condicionada a que el usuario actual sea dueño de la fila padre en `user_lists` — **no** hay una columna `user_id` directa en `list_items`.
- `grant select on user_lists, list_items to anon, authenticated` es necesario junto con las políticas (ya forma parte de la migración de RIK-1 — este ticket no lo vuelve a emitir).

Este ticket no requiere columnas, tablas ni migraciones nuevas. El `ON DELETE CASCADE` en ambas FK ya implica que eliminar una fila de `user_lists` elimina sus filas de `list_items` sin código adicional en la aplicación.

**Uso en código hoy:** ninguno — `services/`, `actions/`, `types/`, `features/` no existen en este repositorio. Este ticket es el primero en escribir en `list_items` para la gestión manual de listas (RIK-9 solo lee/escribe `user_media_status`, y dispara el punto de entrada de "agregar a lista" pero no es dueño de la lógica de mutación de listas).

### Lógica actual (gestión de listas)

No existe implementación previa — territorio nuevo dentro de las restricciones anteriores.

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Nombre de la lista | texto | `user_lists.name` | ya existe (reutilizar) |
| Descripción de la lista | texto, opcional | `user_lists.description` | ya existe (reutilizar) |
| Visibilidad de la lista | booleano | `user_lists.is_public` | ya existe (reutilizar) |
| Identificador de URL (rutas del dueño) | texto | `user_lists.slug` (único por `user_id`, no global) | ya existe (reutilizar) — solo para rutas del dueño, según la nota de frontera anterior |
| Código público compartible | texto | no existe — explícitamente fuera de alcance para este ticket (decisión de RIK-11: columna o tabla nueva) | debe crearse, pero NO por este ticket — construir solo el punto de interfaz `getPublicListUrl(list)` |
| Membresía de un título en una lista | relación | `list_items` (`list_id`, `media_id`) | ya existe (reutilizar) |
| Orden manual dentro de una lista | entero | `list_items.sort_order` | ya existe (reutilizar) |
| Nota por ítem | texto, opcional | `list_items.note` | ya existe (reutilizar) — no está en los criterios de aceptación de este ticket; exponer la columna en el tipo pero no se requiere UI para satisfacer AC-1..AC-4 |

### Archivos impactados

- **types** — `types/index.ts` (o `types/UserList.ts` / `types/ListItem.ts` si RIK-9 ya dividió el barrel de esa forma): agregar/confirmar las interfaces `UserList` y `ListItem` según las columnas reales de la migración (camelCase mapeado desde snake_case).
- **services** — nuevo `services/ListServices/index.ts`: CRUD del lado del dueño (`getUserLists`, `getListBySlug`, `createList`, `renameList`, `deleteList`, `addListItem`, `removeListItem`, `reorderListItems`, `setListVisibility`). No se agrega ningún método de lectura pública aquí — eso es un agregado de RIK-11 a esta misma clase.
- **actions** — nuevo `actions/lists/index.ts`: wrappers `"use server"` alrededor de cada mutación, verificación de sesión vía `supabase.auth.getUser()`, `revalidatePath('/mis-listas')` y `revalidatePath('/mis-listas/[slug]', 'page')` (con el slug real) según corresponda.
- **lib** — nuevo `lib/lists/getPublicListUrl.ts`: helper stub `getPublicListUrl(list: UserList): string | null`, devuelve `null` hasta que RIK-11 lo implemente.
- **components** — nuevos `components/ui/dialog.tsx`, `components/ui/switch.tsx`, `components/ui/tooltip.tsx` (vía `shadcn add`, estilo `base-lyra`, si no fueron agregados por un ticket anterior); nuevo `components/Dialog/AddToListDialog.tsx` (dialog compartido con checkboxes, consumido por el disparador de la ficha de título de RIK-9 y reutilizable desde el detalle de la lista).
- **features** — nuevo slice `features/lists/`: grilla + dialog de crear/editar para `/mis-listas`; pantalla de detalle (switch de visibilidad, botón copiar enlace + tooltip, grilla reordenable, búsqueda inline para agregar título) para `/mis-listas/[slug]`; un pequeño store de Zustand para el estado local de arrastre si la librería de drag lo requiere.
- **app routes** — nuevos `app/(app)/mis-listas/page.tsx` y `app/(app)/mis-listas/[slug]/page.tsx` (Server Components; `params` es una `Promise` en esta versión de Next.js — hay que hacer `await params`).
- **dependencias** — probablemente nuevas `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` en `package.json` para un arrastre-para-reordenar accesible (ver Decisiones tomadas).
- **tests** — todavía no existen en este repositorio; este ticket no agrega archivos de test. Se anota dónde deberían vivir cuando se introduzca un test runner: `services/ListServices/*.test.ts`, `actions/lists/*.test.ts`.

### Decisiones tomadas

1. **El enlace público se queda como stub en este ticket.** `getPublicListUrl(list)` devuelve `null` (u otro centinela explícito de "no listo") sin importar `is_public`; el `Button` "Copiar enlace" se renderiza deshabilitado con un `Tooltip` explicando que el enlace aún no está disponible. **Confirmado por quien encargó el ticket** (instrucción explícita de frontera), no por el texto del ticket en sí.
2. **`slug` es inmutable después de crear la lista.** Renombrar una lista solo actualiza `name`/`description`, nunca `slug` — esto evita romper un enlace que el usuario ya compartió y coincide con que "renombrar" en el criterio de aceptación se refiere al nombre visible. Default recomendado, sin confirmar.
3. **Generación de slug al crear.** Derivar un slug kebab-case desde `name` al momento de creación; ante una colisión de `user_lists_user_slug_uq` para ese usuario, agregar un sufijo numérico corto y reintentar una vez. Default recomendado, sin confirmar.
4. **Librería de arrastrar-para-reordenar.** Usar `@dnd-kit/core` + `@dnd-kit/sortable` (accesible por teclado, compatible con React 19) en vez de eventos HTML5 de drag hechos a mano. Default recomendado, sin confirmar — un fallback con DnD nativo es aceptable si el equipo prefiere cero dependencias nuevas, a costa de la accesibilidad por teclado.
5. **Forma de persistencia del reordenamiento.** `reorderListItems(listId, orderedMediaIds: string[])` hace upsert del `sort_order` de todas las filas en una sola llamada (`supabase.from('list_items').upsert(rows, { onConflict: 'list_id,media_id' })`) en vez de N actualizaciones secuenciales. Default recomendado, sin confirmar.
6. **Dos puntos de entrada de UX para agregar a lista, un solo par de acciones.** El disparador de la ficha de título (propiedad de RIK-9) y la búsqueda "agregar título" del detalle de la lista (propiedad de este ticket) llaman a las mismas `addListItemAction` / `removeListItemAction` — sin lógica de mutación duplicada. Default recomendado, sin confirmar.
7. **Las lecturas evitan `actions/`.** Ambos Server Components de página llaman a `ListServices` directamente con el cliente de servidor ligado a la sesión (refleja el patrón implícito en ARCHITECTURE.md para lecturas autenticadas) — solo las mutaciones pasan por `actions/lists`. Default recomendado, sin confirmar.

### Fuera de alcance

- La página pública `/l/[codigo]` y la variante pública de `/titulo/[slug]` — RIK-11.
- La columna/tabla de código público único a nivel global y su lógica de generación/colisión — decisión de esquema de RIK-11, no de este ticket.
- La colocación del botón disparador en `/titulo/[slug]` — RIK-9 es dueño de esa página; este ticket solo entrega el componente reutilizable `AddToListDialog` que RIK-9 importa.
- Edición de `list_items.note` — la columna existe y está tipada, pero ningún criterio de aceptación exige exponerla en la UI.
- Selección múltiple para agregar/quitar varios títulos a la vez.
- Cualquier scaffolding de suite de tests — no existe en el repositorio todavía.

---

## Plan de implementación

**Objetivo:** entregar el CRUD y el reordenamiento del lado del dueño para `user_lists` / `list_items` detrás de `/mis-listas` y `/mis-listas/[slug]`, usando el RLS que ya define RIK-1, sin tocar nada que sea propiedad de RIK-11.

**En alcance:**
1. Confirmar/extender `types/index.ts` con `UserList` y `ListItem`, según la migración real aterrizada.
2. `services/ListServices/index.ts` — métodos de consulta/mutación del lado del dueño listados arriba.
3. `actions/lists/index.ts` — wrappers de Server Action con verificación de sesión y `revalidatePath`.
4. `lib/lists/getPublicListUrl.ts` — punto de interfaz stub para RIK-11.
5. Agregar los primitivos shadcn `base-lyra` necesarios (`dialog`, `switch`, `tooltip`) si no están presentes.
6. `components/Dialog/AddToListDialog.tsx` — dialog compartido con checkboxes (listas × membresía para un `mediaId`).
7. `features/lists/` — grilla + `Dialog` de crear/editar para `/mis-listas`; pantalla de detalle con `Switch`, `Button` de copiar enlace deshabilitado + `Tooltip`, grilla reordenable por arrastre, y un control de búsqueda inline para agregar título en `/mis-listas/[slug]`.
8. `app/(app)/mis-listas/page.tsx` y `app/(app)/mis-listas/[slug]/page.tsx` — Server Components, `await params`.

**Fuera de alcance:** ver arriba — renderizado público, mecanismo de código público, el cableado del propio disparador de RIK-9.

**Riesgos clave / compatibilidad:**
- El RLS de `list_items` no tiene columna `user_id` — las verificaciones de propiedad pasan por `user_lists`; una `addListItemAction` con un bug que no escope por la lista propia del llamante simplemente fallará en la base de datos (RLS lo niega), lo cual es correcto, pero la acción debe mostrar un error limpio en vez de un error crudo de Postgres.
- `params` es una `Promise` en esta versión de Next.js (ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`) — una desestructuración síncrona romperá la ruta dinámica.
- Eliminar una lista es irreversible (confirmación con `AlertDialog` según la Sección 1.5 del PRD) y en cascada elimina `list_items` vía FK — no se necesita código de limpieza de huérfanos, pero sí se requiere la UX de confirmación.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | Acciones `createList`/`renameList`/`deleteList` + `Dialog` de crear en `/mis-listas` + controles de renombrar/eliminar en `/mis-listas/[slug]` |
| AC-2 | Acciones `addListItem`/`removeListItem`, cableadas desde `AddToListDialog` (punto de entrada de la ficha de título) y desde el control de búsqueda-y-agregar del detalle de la lista |
| AC-3 | Acción `setListVisibility` que persiste `is_public`; `Switch` en `/mis-listas/[slug]`; la invalidación de lectura pública se hereda automáticamente de la política RLS de RIK-1 (`is_public or auth.uid() = user_id`), no requiere código adicional aquí |
| AC-4 | Acción `reorderListItems` que hace upsert de `sort_order`; la grilla de arrastre la llama al soltar; la recarga vuelve a consultar vía `getListBySlug`, confirmando la persistencia |
| AC-5 (aislamiento entre cuentas) | Políticas RLS de RIK-1 (`user_lists_select`, `list_items_select`/`write`) más la ruta usando solo el cliente de servidor ligado a la sesión — nunca `admin.ts` |

---

## Prompt para Claude Code

```xml
<task id="RIK-10" title="Mis listas — owner-side list management" depends_on="RIK-1,RIK-2,RIK-9">
  <role>
    You are a senior full-stack engineer on Rikuna, a Next.js 16 (App Router) + React 19 + TypeScript + Supabase
    personal streaming-rotation planner. You follow the project's layered + feature-sliced architecture strictly.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, auth route groups, services/actions boundary, ingestion vs. user-facing admin.ts rule.</item>
    <item>AGENTS.md — this Next.js version has breaking changes vs. your training data; read the relevant guide under node_modules/next/dist/docs/ before writing route code.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md — confirms `params` is a Promise in app/(app)/mis-listas/[slug]/page.tsx; you must `await params`.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping needed for the commit_message deliverable.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 6 (user_lists/list_items DDL), Section 9.2 (mixed public/private RLS pattern), Section 11.6 (slug is per-user unique only — do not treat it as a public code).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 1.5 (component-per-need mapping: Dialog for create/edit, Switch for visibility, Button+Tooltip for copy-link, Dialog/Popover with checkboxes for add-to-list) and Section 2.2 (/mis-listas and /mis-listas/[slug] screen content).</item>
    <item>components.json — real style is "base-lyra" (Base UI), not the "lyra" (Radix) the PRD text describes; generate all new shadcn primitives in base-lyra.</item>
    <item>package.json — confirm current dependencies before adding @dnd-kit/* or any other new package.</item>
    <item>The most recent migration touching user_lists / list_items in supabase/migrations/ — the authoritative column list, casing, and constraints (this spec's DDL is sourced from the PRD, not verified code).</item>
    <item>types/index.ts, services/index.ts, actions/index.ts (or their barrel equivalents) if they exist — to see what RIK-1/RIK-2/RIK-9 already established for UserList, ListItem, and the session-check pattern used by other actions/ folders.</item>
    <item>Any existing components/MediaCard/ implementation — list grids reuse it; do not create a second title-card component.</item>
    <item>CHANGELOG.md — format and where to append entries under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna lets a user build free-form lists of titles (user_lists) with ordered items (list_items), each list
    either private (owner-only) or public (readable without a session, once RIK-11 ships the actual public page).
    RIK-1 creates both tables with RLS already handling the public/private read split; RIK-2 creates the
    (app) route group and its auth guard; RIK-9 creates /titulo/[slug] and will import a shared "add to list"
    dialog component from this ticket. This ticket is the FIRST to write to list_items.

    user_lists columns (verify against the real migration before coding): id (uuid pk), created_at, updated_at,
    user_id (uuid, references auth.users, cascade), name (text), slug (text, unique per user_id via
    user_lists_user_slug_uq — NOT globally unique), description (text, nullable), is_public (boolean, default false).

    list_items columns: id (uuid pk), created_at, list_id (uuid, references user_lists, cascade), media_id
    (uuid, references media_items, cascade), sort_order (integer, default 0), note (text, nullable). Unique
    constraint list_items_uq on (list_id, media_id) — a title can only appear once per list.

    list_items has NO user_id column of its own — ownership is entirely inherited through list_id -> user_lists.user_id.
    Every list_items mutation must be scoped through a list the caller owns; rely on RLS to enforce this at the
    database layer (do not attempt to replicate ownership logic in application code beyond what's needed for a
    clean error message).
  </context>

  <ground_truth_db_notes critical="true">
    <note>user_lists.slug is unique only per (user_id, slug), NOT globally. Never use it as, or build it into, a public sharing code — that is a deliberate, separate mechanism RIK-11 owns.</note>
    <note>There is no public-code column on user_lists yet, and this ticket must not add one. Build the "copy link" affordance as a call to a getPublicListUrl(list: UserList): string | null stub in lib/lists/getPublicListUrl.ts that currently always returns null. RIK-11 will replace the body of this function; do not change its signature without a reason documented in this ticket's completion report.</note>
    <note>RLS for user_lists/list_items (already applied by RIK-1's migration, do not re-issue the policies or the anon/authenticated grants): user_lists_select uses (is_public or auth.uid() = user_id); user_lists_write/update/delete require auth.uid() = user_id; list_items_select and list_items_write both check ownership via an EXISTS subquery against user_lists — there is no direct RLS column on list_items itself.</note>
    <note>ON DELETE CASCADE is already defined on list_items.list_id -> user_lists.id. Deleting a list does not require any explicit cleanup of its items in application code.</note>
    <note>components.json declares "style": "base-lyra" and package.json includes @base-ui/react — this project uses Base UI, not Radix, despite what the PRD prose says. Add new shadcn primitives (dialog, switch, tooltip) with the base-lyra style.</note>
    <note>Lyra styling means border-radius 0 everywhere — do not add rounded-* classes to any new component.</note>
    <note>lib/supabase/admin.ts (service-role client) must never be imported by anything under actions/lists or services/ListServices — this feature is entirely user-scoped and RLS-enforced, exactly like the rest of the (app) zone.</note>
    <note>params in app/(app)/mis-listas/[slug]/page.tsx is a Promise in this Next.js version — write `const { slug } = await params;` inside an async Server Component, not a synchronous destructure.</note>
  </ground_truth_db_notes>

  <story>
    As a signed-in Rikuna user, I want to freely create, rename, and delete my own lists, add or remove titles
    from them (from the list itself or from a title's detail page), reorder titles within a list, and toggle a
    list public or private, so that I can curate and eventually share collections of what I want to watch,
    while keeping the rest of my account private by default.
  </story>

  <requirements>
    <phase title="Dependencies">
      <item>Add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities to package.json for accessible drag-to-reorder, unless the team has already added an equivalent library — check package.json first. If you choose a native-HTML5-DnD fallback instead, document the tradeoff (loses keyboard accessibility) in the completion report's decisions.</item>
    </phase>

    <phase title="Types">
      <item>In types/index.ts (or the established per-resource file pattern from earlier tickets), confirm or add UserList { id, createdAt, updatedAt, userId, name, slug, description, isPublic } and ListItem { id, createdAt, listId, mediaId, sortOrder, note } with camelCase fields mapped from the real snake_case columns.</item>
      <item>Add a ListWithItemCount (or equivalent) read shape for the /mis-listas grid (name, slug, isPublic, itemCount) if the plain UserList type doesn't already carry a count — do not add an itemCount column to the table; compute it in the service query (e.g. a count aggregate or a second query).</item>
    </phase>

    <phase title="Services">
      <item>Create services/ListServices/index.ts exporting a class that takes a SupabaseClient in its constructor, mirroring the pattern of other services/ folders.</item>
      <item>getUserLists(userId): fetch all of the caller's own lists with an item count.</item>
      <item>getListBySlug(userId, slug): fetch one owned list plus its list_items joined to media_items (for MediaCard rendering), ordered by sort_order. Return null if not found or not owned (RLS + explicit user_id filter, not just RLS alone, so a not-owned-but-still-public list correctly resolves as "not my list" on this owner-only route rather than silently rendering someone else's public list).</item>
      <item>createList(userId, { name, description }): generate a kebab-case slug from name; on a user_lists_user_slug_uq collision for that user, append a short numeric suffix and retry once.</item>
      <item>renameList(id, { name, description }): update name/description only — never touch slug.</item>
      <item>deleteList(id): delete the user_lists row; rely on ON DELETE CASCADE for list_items.</item>
      <item>addListItem(listId, mediaId): insert into list_items with sort_order = current max + 1 for that list; handle the list_items_uq unique violation gracefully (treat "already in list" as a no-op success, not an error).</item>
      <item>removeListItem(listId, mediaId): delete the matching row.</item>
      <item>reorderListItems(listId, orderedMediaIds: string[]): upsert sort_order for every row in one call using onConflict: 'list_id,media_id', setting sort_order to each item's index in the array.</item>
      <item>setListVisibility(listId, isPublic: boolean): update is_public.</item>
      <item>getListsContainingMedia(userId, mediaId): for AddToListDialog — return the caller's lists plus a boolean of whether mediaId is already in each, in one query.</item>
    </phase>

    <phase title="Actions">
      <item>Create actions/lists/index.ts with "use server" Server Actions wrapping every ListServices mutation above (not the reads — reads happen directly from Server Components per the pattern implied by ARCHITECTURE.md).</item>
      <item>Every action calls supabase.auth.getUser() first and returns an explicit error/redirect if unauthenticated, instantiates ListServices with the same session-bound client, then calls the matching service method.</item>
      <item>After createList/renameList/deleteList/setListVisibility: revalidatePath('/mis-listas') and, where a specific list's own page is affected, revalidatePath(`/mis-listas/${slug}`).</item>
      <item>After addListItem/removeListItem/reorderListItems: revalidatePath(`/mis-listas/${slug}`) for the affected list, and revalidatePath for the title's own page if you have the slug available (coordinate with RIK-9's title-page revalidation pattern if it already exists).</item>
    </phase>

    <phase title="Shared helper">
      <item>Create lib/lists/getPublicListUrl.ts exporting getPublicListUrl(list: UserList): string | null. For now, always return null regardless of list.isPublic — this is intentionally a stub RIK-11 will implement. Add a TODO comment referencing RIK-11.</item>
    </phase>

    <phase title="Components">
      <item>Add base-lyra shadcn primitives dialog, switch, tooltip if not already present in components/ui/ (check first — RIK-9 may have added some already).</item>
      <item>Create components/Dialog/AddToListDialog.tsx: given a mediaId, fetch the caller's lists via getListsContainingMedia, render each as a checkbox row (checked = already contains the title), toggling calls addListItemAction/removeListItemAction. This component takes no assumptions about where it's triggered from — RIK-9 will import and trigger it from /titulo/[slug]; this ticket does not add that trigger button itself.</item>
    </phase>

    <phase title="Features — /mis-listas">
      <item>features/lists/ListGrid.tsx (or similar): render the user's lists as cards — name, item count, visibility Badge (Pública/Privada), click-through to /mis-listas/[slug].</item>
      <item>features/lists/CreateListDialog.tsx: a Dialog with name + description fields, reused for both "Nueva lista" (create) and rename (edit) per the PRD's "Dialog para crear/editar" — pass an optional existing list to switch modes.</item>
      <item>Empty state when the user has no lists yet: message + "Nueva lista" button.</item>
    </phase>

    <phase title="Features — /mis-listas/[slug]">
      <item>features/lists/ListDetail.tsx: header with name, description, a Switch bound to setListVisibilityAction, and a Button+Tooltip "Copiar enlace" that is disabled (tooltip explains "Disponible próximamente") when getPublicListUrl(list) returns null — which it always does for now.</item>
      <item>Reorderable grid of MediaCard using @dnd-kit sortable context; on drag end, call reorderListItemsAction(listId, newOrderedMediaIds) and optimistically update local state (Zustand store or component state) while the request is in flight.</item>
      <item>An inline title search-and-add control (Input or Command per the PRD's search component guidance) that queries existing catalog search (reuse whatever MediaServices search method RIK-3/RIK-9 already established) and calls addListItemAction(listId, mediaId) on selection.</item>
      <item>Remove-from-list action (icon button per card) calling removeListItemAction.</item>
      <item>Rename/delete controls: reuse CreateListDialog for rename; an AlertDialog-confirmed delete that redirects to /mis-listas on success.</item>
      <item>Not-found handling: if getListBySlug returns null (list doesn't exist or the caller doesn't own it), render Next.js notFound().</item>
    </phase>

    <phase title="Routes">
      <item>app/(app)/mis-listas/page.tsx: async Server Component, get the session user, call ListServices(supabase).getUserLists(userId) directly, pass initial data into the ListGrid feature component.</item>
      <item>app/(app)/mis-listas/[slug]/page.tsx: async Server Component with `params: Promise<{ slug: string }>` — await params, call getListBySlug(userId, slug), notFound() if null, otherwise render ListDetail with initial data.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">A user can create a list (name + optional description) via the Dialog on /mis-listas, see it appear in the grid with 0 items, rename it via the same Dialog in edit mode (name changes, slug does not), and delete it via a confirmed AlertDialog, after which it no longer appears in the grid and a direct GET to its old /mis-listas/[slug] returns notFound(). Verify: UI flow plus a SELECT on user_lists showing the row created/updated/absent.</criterion>
    <criterion id="AC-2">A user can add a title to a list from the list detail screen's search-and-add control, and remove it from the same screen; a user can also add/remove the same title to/from one of their lists via AddToListDialog (simulate RIK-9's trigger by rendering the component directly with a known mediaId if /titulo/[slug] isn't wired yet). Verify: list_items row appears/disappears for the correct (list_id, media_id) pair.</criterion>
    <criterion id="AC-3">Toggling the Switch on /mis-listas/[slug] to public immediately persists user_lists.is_public = true (no page reload required to see the Switch reflect the new state); toggling back to private persists is_public = false. Verify: SELECT is_public after each toggle, and confirm the RLS policy (user_lists_select) means an anon/other-user client can no longer read that row once is_public = false — this is enforced by RIK-1's existing policy, not new code, but must be demonstrated working end-to-end here.</criterion>
    <criterion id="AC-4">Dragging a title to a new position within a list's grid persists the new sort_order and the new order survives a full page reload (not just client state). Verify: drag two items, reload the page, confirm the rendered order matches, and SELECT list_items ORDER BY sort_order for that list_id matches the displayed order.</criterion>
    <criterion id="AC-5">A second user account cannot see or edit the first user's private list: navigating to the first user's /mis-listas/[slug] as the second user returns notFound() (not a 403 page, not the other user's data), and the second account's /mis-listas grid never shows the first account's lists. Verify with two real accounts (or two Supabase sessions) end-to-end.</criterion>
    <criterion id="AC-6">Deleting a list removes its list_items rows without orphaning them (ON DELETE CASCADE). Verify: SELECT count(*) from list_items where list_id = &lt;deleted id&gt; returns 0 after deletion.</criterion>
    <criterion id="AC-7">getPublicListUrl(list) exists in lib/lists/getPublicListUrl.ts, is called by the Copy Link button, and this ticket introduces no public short-code column, table, or route — grep the diff for any new column/table named anything like public_code/share_code/short_code and confirm there is none.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new Supabase migration — user_lists and list_items already exist from RIK-1. If the real migration's columns differ from this prompt's ground_truth_db_notes, stop and reconcile against the actual file before writing queries; do not silently invent columns.</item>
    <item>Do NOT rename or drop user_lists.slug, and do NOT make it globally unique — it stays the internal per-user identifier used only by /mis-listas/[slug].</item>
    <item>Do NOT implement the public short code column/table/generation logic, and do NOT add a real implementation inside getPublicListUrl — it must remain a stub returning null, per the RIK-11 boundary.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere in actions/lists or services/ListServices.</item>
    <item>Do NOT touch app/(public)/ or any (public) route group files — this ticket is entirely inside (app).</item>
    <item>Do NOT add Radix-based shadcn components — this project uses the base-lyra (Base UI) style exclusively.</item>
    <item>Do NOT add rounded corners (Lyra style mandates border-radius 0) on any new component.</item>
    <item>Do NOT build a second title-card component if components/MediaCard/ already exists from an earlier ticket — reuse it.</item>
  </constraints>

  <out_of_scope>
    <item>/l/[codigo] public list page and the public /titulo/[slug] variant — RIK-11.</item>
    <item>The globally-unique public short code mechanism itself — RIK-11's schema decision.</item>
    <item>Placing the "Agregar a lista" trigger button on /titulo/[slug] — RIK-9 owns that page; this ticket only ships the AddToListDialog component for RIK-9 to import.</item>
    <item>Editing list_items.note — the column exists and is typed but no UI is required for it.</item>
    <item>Bulk multi-select add/remove of titles.</item>
    <item>Any automated test suite — none exists in this repo yet.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Slug generation suggestion: a small kebab-case slugify (lowercase, strip diacritics, replace non-alphanumerics with hyphens) plus a retry-with-suffix loop bounded to a handful of attempts, to avoid infinite loops on a pathological name.</item>
    <item>reorderListItems upsert shape: rows = orderedMediaIds.map((mediaId, index) => ({ list_id: listId, media_id: mediaId, sort_order: index })); supabase.from('list_items').upsert(rows, { onConflict: 'list_id,media_id' }) — this only works if the unique constraint name/columns match list_items_uq exactly; verify against the real migration.</item>
    <item>getListBySlug should filter by both slug and the caller's own user_id explicitly in the query (not rely on RLS alone) so that a public list belonging to someone else never renders on this owner-only route just because RLS would technically allow reading it.</item>
  </implementation_notes>

  <deliverables>
    <item>All source files listed in the requirements phases above.</item>
    <item>Run npm run lint and fix any issues introduced by this change.</item>
    <item>No test files (none exist yet in this repo) — note in the completion report where they should live once a test runner is introduced.</item>
    <item>Persist documentation per <completion_report>/<persistence> below: one bullet in CHANGELOG.md under [Unreleased], and one file in specs/logs/.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Drag-to-reorder library: defaulting to @dnd-kit/core + @dnd-kit/sortable. If the team prefers zero new dependencies, fall back to native HTML5 drag events and note the accessibility tradeoff.</item>
    <item>Slug immutability on rename: defaulting to never changing slug after creation. If the team wants renaming to also regenerate the slug, that changes the AC-1 verification and needs a redirect strategy for the old URL.</item>
    <item>Public link placeholder UX: defaulting to a disabled Button + explanatory Tooltip when getPublicListUrl returns null. If the team wants the button hidden entirely instead of disabled, adjust ListDetail accordingly — either satisfies AC-7.</item>
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
        <item>Format: `- RIK-10: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-10_user_lists_management.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Link to specs/backlog/RIK-10_user_lists_management.md in the metadata table.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / actions / components / features / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-10 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "your lists page" instead of naming the route, "the visibility toggle" instead of naming the column, "the share link button" instead of naming the helper function.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Include "## Screenshots" (this ticket has user-visible UI): list 3–4 items, each with a placeholder like [attach: label] — e.g. "My lists — grid with a private and a public list", "List detail — visibility switch and disabled share button", "List detail — drag-reordered grid after reload", "Cross-account check — second account cannot open the first account's private list".</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is Mixed UI + Database — include both "## UI validation" and "## Database validation".</item>
      <item>"## Prerequisites": dev server running, two Supabase test accounts logged into two browser sessions (or one incognito), at least one existing title in the catalog to add to a list.</item>
      <item>"## UI validation": numbered steps covering create list, rename, add a title from the list detail search, add/remove the same title via the add-to-list dialog, drag-reorder and reload, toggle visibility, delete a list, and the cross-account check at /mis-listas/[slug] with the second account's session — each step states the expected visible result.</item>
      <item>"## Database validation": read-only SQL against user_lists and list_items confirming is_public, sort_order after reorder, and row absence after delete — use the real table/column names from the codebase.</item>
      <item>"## Expected outcome": 1–3 bullets tying back to the acceptance criteria.</item>
    </deliverable>
  </completion_report>
</task>
```

# RIK-12 — App shell: Header + Sidebar navigation

> Documento de lectura. La fuente de verdad es [`RIK-12_app_shell_navigation.md`](./RIK-12_app_shell_navigation.md).

## Resumen del ticket

Construir los componentes `Header` y `Sidebar` que la zona autenticada nunca tuvo, y conectarlos en `app/(app)/layout.tsx` para que cada página bajo `/panel`, `/recomendaciones`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar` y `/perfil` se renderice dentro de navegación real en vez de contenido pelado.

- Header: logo que enlaza a `/panel`, y a la derecha un `Avatar` + `DropdownMenu` con el nombre/correo del usuario, un enlace a `/perfil`, un toggle de tema claro/oscuro, un separador y un ítem destructivo "Cerrar sesión" conectado a la acción `signOut` ya existente.
- Sidebar: siempre visible en desktop (colapsable), se convierte en un `Sheet` abierto desde un ícono de menú del header en mobile. Seis ítems — Qué ver este mes, Recomendaciones, Mi biblioteca, Mis listas, Mis suscripciones, Importar desde IMDb — cada uno enlazando a su ruta con resaltado de ruta activa.
- Este es el vacío de mayor impacto encontrado contra `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` (Sección 1.6): `app/(app)/layout.tsx` hoy no renderiza ningún chrome, así que cada pantalla autenticada enviada hasta ahora (RIK-6 a RIK-11) no tiene forma de navegar entre pantallas salvo escribiendo URLs.
- No hay comentarios de equipo — este ticket se deriva directamente de un análisis de vacíos contra el repositorio real, no de un ticket pegado desde un tracker. La familia tipográfica queda explícitamente fuera de alcance por pedido del solicitante.
- `/biblioteca` y `/perfil` son destinos de enlace en el sidebar/menú cuyas páginas reales se entregan en tickets hermanos (RIK-14, RIK-15) — enlazarlas aquí es cableado intencional hacia adelante, no un error.

---

## Contexto

### Ticket original

No existe un ticket de tracker para este trabajo. Se definió comparando directamente `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` Sección 1.6 ("Layouts compartidos — Header + Sidebar") contra el estado real de `app/(app)/layout.tsx`, `components/` y `features/`, siguiendo primero `graphify-out/GRAPH_REPORT.md` según la regla de graphify de `CLAUDE.md` de este repo (se confirmó que no existe ningún nodo Header/Sidebar/DropdownMenu en el grafo, ni ninguna comunidad que cubra esta área — el vacío es real, no un desajuste de nombres).

Requisitos del PRD incorporados aquí (Sección 1.6, intención verbatim):

- Tres de las cuatro variantes de layout del PRD comparten los mismos dos componentes (Header, Sidebar) con contenido distinto según el estado de sesión; este ticket construye **solo la variante autenticada**. La variante sin sesión (Marketing) es responsabilidad de RIK-13, reutilizando lo que este ticket entrega.
- Header, con sesión: logo → `/panel` a la izquierda; `Avatar` + `DropdownMenu` a la derecha. Menú: encabezado no interactivo con nombre/correo, separador, "Perfil" → `/perfil`, "Cambiar tema" (toggle, sin submenú porque la app es solo oscuro/claro hoy — ver notas de verdad de terreno), separador, "Cerrar sesión" (estilo destructivo, ejecuta la acción de cierre de sesión, redirige).
- Header mobile: un ícono de menú (`≡`) que abre el Sidebar como un `Sheet` lateral.
- Sidebar, con sesión: siempre visible en desktop, colapsable; ítems — Qué ver este mes (`/panel`, ícono `Home`/`LayoutDashboard`), Recomendaciones (`/recomendaciones`, `Sparkles`), Mi biblioteca (`/biblioteca`, `Library`), Mis listas (`/mis-listas`, `ListVideo`), Mis suscripciones (`/suscripciones`, `Tv`), Importar desde IMDb (`/importar`, `Upload`). La ruta activa se resalta. "Perfil" y "Cerrar sesión" **no** se duplican en el sidebar — viven solo en el menú del avatar.
- Componentes sugeridos (PRD Sección 1.5/1.6): `Avatar`, `DropdownMenu`, `DropdownMenuItem`, `Separator`, `Button`, `Sheet`, `Tooltip` (etiquetas en modo colapsado).

### Comentarios del equipo

Ninguno — ver "Ticket original" arriba para cómo se derivó el alcance de este ticket.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el código | Impacto |
| --- | --- | --- |
| El PRD Sección 1.3 documenta `components.json` como `"style": "lyra"` (shadcn basado en Radix) | El `components.json` real del repo es `"style": "base-lyra"` — la variante Base UI (`@base-ui/react`, no Radix) | Cada primitiva shadcn agregada aquí (`dropdown-menu`, `sheet`, `separator`) debe ser la variante Base UI, agregada vía CLI con la config real del proyecto; no escribir a mano APIs de Radix |
| El PRD da a entender que Header/Sidebar son trabajo nuevo, no iniciado | `ARCHITECTURE.md` (actualmente modificado, sin commitear, en `main`) ya documenta la forma **objetivo** en detalle: una carpeta `components/layout/` con `Header` + `Sidebar`, una tabla de rutas que lista el shell de cada ruta, y `lib/supabase/proxy.ts`'s `PROTECTED_PREFIXES` ya incluye `/biblioteca` y `/perfil` aunque esas páginas no existan todavía | Tratar la sección de rutas/shell sin commitear de `ARCHITECTURE.md` como el diseño objetivo autoritativo, no una hipótesis — este ticket la implementa en vez de inventar una estructura nueva |
| El dominio del ticket (PRD) no menciona ningún mecanismo de cierre de sesión existente | `actions/auth/signOut.ts` ya existe, exportado desde `actions/auth/index.ts`: una función `"use server"` que llama `supabase.auth.signOut()` y `redirect("/auth/login")` | Reutilizarla tal cual dentro del menú del avatar; no escribir una segunda acción de cierre de sesión. Nota: el PRD Sección 1.6 dice que el ítem del menú "redirige a `/`" — la acción existente redirige a `/auth/login` en cambio (ver Decisiones) |
| El PRD asume un submenú de tema ("claro/oscuro") | `app/layout.tsx` configura `next-themes` con `attribute="class" defaultTheme="dark" enableSystem={false}` — solo hay dos temas en juego (sin opción "sistema"), y no existe ningún componente `ThemeToggle` todavía | Un toggle de un solo clic claro/oscuro es suficiente; no se necesita un submenú de tres vías |
| El PRD lista "Perfil" y el toggle de tema como ítems de menú asumiendo una página de cuenta completa | `/perfil` no existe todavía (se entrega en RIK-15, no especificado aún al momento de escribir este ticket — en realidad especificado junto con este, ver tickets relacionados) | Enlazar a `/perfil` de todas formas; Next.js no falla en build time por un `<Link>` a una ruta que no existe todavía, solo al hacer clic hasta que RIK-15 se entregue |

### Estado actual en la base de datos

No aplica — este ticket no toca ninguna tabla. `getCurrentUser()` (`lib/supabase/server.ts`) ya devuelve todo lo que el Header necesita:

```ts
export type CurrentUser = {
  id: string
  email: string | null
  fullName: string | null
}
```

No hay ningún campo de URL de imagen de avatar en ningún lado de este tipo ni en el uso de metadata de usuario de Supabase Auth en el resto del repo — el avatar debe renderizar solo iniciales, el mismo patrón que `features/title/CastList.tsx` ya usa (`initials()`, primeras letras de hasta dos partes del nombre separadas por espacio, en mayúscula) vía `AvatarFallback`.

### Lógica actual (`app/(app)/layout.tsx`)

Verbatim, el archivo completo hoy:

```tsx
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { UserProvider } from "@/components/providers/UserProvider"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()

  // Belt-and-suspenders with the proxy-level check: Server Functions bypass
  // proxy matchers, so this Server Component check is the real backstop.
  if (!user) {
    redirect("/auth/login")
  }

  return <UserProvider user={user}>{children}</UserProvider>
}
```

Realiza el guard de autenticación e hidrata `UserProvider`/`useSession()`/`useUserContext()` (`components/providers/UserProvider.tsx`, `hooks/useSession.ts`) — ambos sin tocar en este ticket — pero **no renderiza ningún chrome**. Se confirmó vía `grep` en `app/(app)/**` y `components/`/`features/` que no existe ningún archivo que coincida con `Sidebar`, `Header`, o `DropdownMenu` en todo el repo.

`lib/supabase/proxy.ts` (`updateSession`, invocado desde el `proxy.ts` raíz según la convención de guard raíz de Next.js 16 ya vigente) ya protege `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil` a nivel middleware — el guard de Server Component en `(app)/layout.tsx` de este ticket se mantiene como el respaldo documentado "belt-and-suspenders" y no se toca más allá de envolver su retorno en el nuevo shell.

### Mapeo de campos solicitados

No aplica — este ticket no solicita ningún campo persistido; es solo UI, consumiendo el tipo `CurrentUser` ya definido.

### Archivos impactados

**Componentes (nuevos)**
- `components/layout/Header.tsx` — logo, avatar/menú desplegable, disparador de menú hamburguesa mobile.
- `components/layout/Sidebar.tsx` — lista de ítems de navegación, resaltado de ruta activa, estado de colapso en desktop, cuerpo del `Sheet` en mobile.
- `components/layout/SidebarNavItem.tsx` — un enlace + ícono + etiqueta + `Tooltip` (estado colapsado), reutilizado tanto en desktop como en mobile.
- `components/layout/ThemeToggle.tsx` — toggle pequeño basado en `useTheme()`, usado dentro del `DropdownMenu` del avatar.
- `constants/navigation.ts` — la lista de seis ítems de navegación (`{ label, href, icon }`) como fuente única de verdad para `Sidebar`, para que la variante marketing de RIK-13 y cualquier lógica futura de breadcrumb/título mobile no copien la lista a mano.

**Rutas de app (modificadas)**
- `app/(app)/layout.tsx` — componer `Header` + `Sidebar` alrededor de `{children}`, todavía dentro de `UserProvider`, todavía protegido por el `redirect` existente.

**Primitivas de UI (nuevas vía CLI de shadcn, estilo `base-lyra`)**
- `components/ui/dropdown-menu.tsx`, `components/ui/sheet.tsx`, `components/ui/separator.tsx` — ninguno de los tres existe hoy (confirmado vía `ls components/ui/`); `avatar.tsx`, `button.tsx`, `tooltip.tsx` ya existen y se reutilizan tal cual.

**Sin cambios** en `services/`, `actions/` (más allá de importar el `signOut` existente), `types/`, ni ningún archivo de `supabase/migrations/`.

### Decisiones tomadas

1. **Destino de redirección al cerrar sesión: mantener el comportamiento existente de `actions/auth/signOut.ts` (`/auth/login`), no el literal `/` del PRD.** Razón: la acción ya existe y presumiblemente se usa en otros flujos; reescribir su destino de redirección es un cambio de una línea, de bajo riesgo, pero fuera del alcance real de este ticket (navegación, no comportamiento del flujo de auth). Default recomendado, no confirmado — marcado en `<clarify_before_coding>`.
2. **El toggle de tema es un control de un solo clic (claro ⇄ oscuro), no un submenú de tres vías "claro/oscuro/sistema".** Razón: `enableSystem={false}` en la config existente de `ThemeProvider` significa que "sistema" ya fue excluido deliberadamente; igualarlo en el toggle nuevo evita introducir un tercer estado que la app no soporta en ningún otro lado. Confirmado contra la config real, no una suposición.
3. **El estado de colapso del sidebar en desktop es estado local de componente (`useState`), no persistido en `localStorage` ni en un store de Zustand.** Razón: la sección `stores/` de `ARCHITECTURE.md` describe Zustand para estado realmente compartido entre features (filtros, flags de UI reutilizados en otro lado) — un solo booleano de colapso limitado a un layout no cumple ese criterio. Persistir entre recargas es un follow-up barato, no un bloqueante para este ticket. Default recomendado.
4. **Nueva `constants/navigation.ts` como fuente única de verdad para los seis ítems de navegación**, en vez de poner el array directamente en `Sidebar.tsx`. Razón: la carpeta `constants/` de `ARCHITECTURE.md` ya existe exactamente para este tipo de configuración estática (`recommendationThresholds.ts`, `platforms.ts`), y la variante Marketing del sidebar de RIK-13 necesitará su propia lista de ítems separada — mantener la lista de App en su propio export facilita distinguir las dos. Default recomendado.
5. **El avatar renderiza solo iniciales (`AvatarFallback`), nunca `AvatarImage`.** Razón: `CurrentUser` no tiene ningún campo de URL de avatar en ningún lado del código ni en el uso de Supabase Auth; inventar uno está fuera de alcance. Confirmado vía `types` y `lib/supabase/server.ts`.
6. **`Header`/`Sidebar` reciben `user: CurrentUser` y la lista de ítems de navegación como props explícitas, no vía lecturas de `useSession()`/contexto dentro de los propios componentes.** Razón: el patrón declarado en `ARCHITECTURE.md` es "Server Components fetch via actions/services and pass initial data as props" — `(app)/layout.tsx` ya tiene `user` en scope desde `getCurrentUser()`, así que pasarlo como prop mantiene `Header`/`Sidebar` lo suficientemente agnósticos del framework para que RIK-13 los reutilice con datos de usuario distintos (o ausentes), sin un segundo context provider. Default recomendado, habilita directamente el plan de reutilización de RIK-13.

### Fuera de alcance

- La variante Marketing (sin sesión) de Header/Sidebar y la página `/` en sí — RIK-13, que depende de que los componentes de este ticket existan.
- El contenido de las páginas `/biblioteca` y `/perfil` — RIK-14 y RIK-15 respectivamente; este ticket solo enlaza hacia ellas.
- Persistir el estado de colapso del sidebar entre recargas — follow-up barato, no requerido por el comportamiento declarado del PRD ("colapsable" no exige persistencia).
- Cambiar el destino de redirección de `signOut` de `/auth/login` a `/` — follow-up de una línea si se confirma que el texto literal del PRD es un requisito real (ver Decisión 1).
- Editar `middleware.ts`/`lib/supabase/proxy.ts` — ya está correctamente configurado para cada ruta que este ticket enlaza.

---

## Plan de implementación

**Objetivo:** Dar a cada pantalla autenticada un chrome de navegación real construyendo `Header` + `Sidebar` una sola vez, en `components/layout/`, y componiéndolos en `app/(app)/layout.tsx` — cerrando el vacío más grande entre la app entregada y `RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md`.

**En alcance:**
1. Agregar las primitivas shadcn faltantes: `dropdown-menu`, `sheet`, `separator` (variante Base UI / `base-lyra`, vía CLI).
2. `constants/navigation.ts` — la lista de seis ítems de navegación autenticada.
3. `components/layout/ThemeToggle.tsx` — control de flip claro/oscuro con `useTheme()`.
4. `components/layout/SidebarNavItem.tsx` — enlace + ícono + etiqueta + estilo de estado activo + `Tooltip` en estado colapsado.
5. `components/layout/Sidebar.tsx` — riel siempre visible/colapsable en desktop usando los ítems de navegación; cuerpo de `Sheet` en mobile reutilizando la misma lista de ítems.
6. `components/layout/Header.tsx` — logo → `/panel`, hamburguesa mobile que abre el `Sheet` del `Sidebar`, `Avatar` + `DropdownMenu` (encabezado nombre/correo, Perfil, ThemeToggle, separador, Cerrar sesión destructivo llamando a `signOut`).
7. Conectar ambos en `app/(app)/layout.tsx` alrededor de `{children}`, sin tocar el guard de redirección existente ni el `UserProvider`.

**Fuera de alcance:** Variante Marketing (RIK-13), contenido de páginas `/biblioteca` y `/perfil` (RIK-14/RIK-15), persistencia del estado de colapso, cambio del destino de redirección de `signOut` — ver Fuera de alcance arriba.

**Riesgos clave / compatibilidad:**
- Este ticket cambia `app/(app)/layout.tsx`, por el que ya pasa cada ruta autenticada (`/panel` hasta `/importar/[batchId]`) — un error de runtime a nivel de layout aquí rompe las siete. Mantener el cambio aditivo (envolver `{children}`, no reestructurar el guard).
- Enlazar a `/biblioteca` y `/perfil` antes de que RIK-14/RIK-15 se entreguen es intencional, no un defecto — Next.js solo devuelve 404 al hacer clic, no falla el build.
- `Header`/`Sidebar` deben renderizar correctamente con `fullName: null` (un usuario que nunca configuró un nombre visible) — usar `email` como respaldo tanto para la etiqueta visible como para el input de las iniciales.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | `Header` se renderiza en cada ruta `(app)` vía el cambio de layout |
| AC-2 | `Sidebar` seis ítems, `constants/navigation.ts`, resaltado de ruta activa vía `usePathname()` |
| AC-3 | Comportamiento de colapso en desktop del `Sidebar` |
| AC-4 | Sidebar mobile basado en `Sheet`, disparado desde el ícono hamburguesa del `Header` |
| AC-5 | Estructura del `DropdownMenu`: nombre/correo, Perfil, ThemeToggle, separador, Cerrar sesión destructivo |
| AC-6 | `ThemeToggle` cambia la clase de tema resuelta de `next-themes` |
| AC-7 | Form action de `signOut` dentro del `DropdownMenuItem` |
| AC-8 | Respaldo de iniciales `AvatarFallback` del Avatar para nombre faltante |

---

## Prompt para Claude Code

```xml
<task id="RIK-12" title="App shell: Header + Sidebar navigation">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access),
    with components/ reserved for shared, cross-feature UI.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full. It is currently MODIFIED and UNCOMMITTED on the working tree
      (confirmed via `git status`/`git diff`) and already documents the target shape this ticket
      implements: a `components/layout/` folder with `Header` + `Sidebar`, the full routing table (every
      path's shell), and the `(marketing)`/`(auth)`/`(app)`/`(public)` route-group boundaries. Treat its
      routing table and Shared UI section as the authoritative target design, not a draft to second-guess.</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data.
      Read node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md before touching
      app/(app)/layout.tsx if you need to confirm redirect() semantics inside a Server Component layout
      (unchanged behavior expected — you are not modifying the guard logic itself).</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 1.6 ("Layouts compartidos — Header +
      Sidebar") — the full authenticated-variant spec: header contents, avatar menu items and order,
      sidebar item list with suggested icons, mobile behavior (Sheet from a header hamburger icon),
      desktop collapse behavior with Tooltip on collapsed items. Section 1.5 for the general
      component-per-need mapping (Avatar, DropdownMenu, Sheet, Tooltip, Separator, Button).</item>
    <item>app/(app)/layout.tsx — the exact current file (~15 lines): the auth guard
      (`getCurrentUser()` + `redirect("/auth/login")` if absent) and the `UserProvider` wrap. Your change
      must be additive around `{children}` — do not remove or reorder the guard or the provider.</item>
    <item>lib/supabase/server.ts — read the `CurrentUser` type (`id`, `email`, `fullName`, all but `id`
      nullable) and `getCurrentUser()`. This is the only user data available; there is no avatar-image
      field anywhere in this project.</item>
    <item>components/providers/UserProvider.tsx and hooks/useSession.ts — existing context/hook you are
      NOT changing; `Header`/`Sidebar` receive `user` as an explicit prop from the layout instead of
      reading this context internally (see ground truth notes).</item>
    <item>actions/auth/signOut.ts and actions/auth/index.ts — the existing, already-implemented sign-out
      Server Action (`supabase.auth.signOut()` then `redirect("/auth/login")`). Reuse it exactly as-is;
      do not write a second sign-out action.</item>
    <item>app/layout.tsx — the root layout's existing `ThemeProvider` config
      (`attribute="class" defaultTheme="dark" enableSystem={false}`) from `next-themes`, and the existing
      `TooltipProvider` wrap (already present — do not add a second one).</item>
    <item>components.json — confirm the real shadcn config: `"style": "base-lyra"` (Base UI, not Radix),
      `"baseColor": "mist"`, `"iconLibrary": "lucide"`. Every new component you add via the CLI must use
      this config.</item>
    <item>components/ui/avatar.tsx, components/ui/button.tsx, components/ui/tooltip.tsx — existing
      primitives to reuse as-is; do not regenerate them.</item>
    <item>features/title/CastList.tsx — read its local `initials(name: string)` helper (first letters of
      up to two space-separated name parts, uppercased). Mirror this exact behavior locally in
      components/layout/Header.tsx rather than importing it (it is not exported) or inventing a different
      algorithm.</item>
    <item>lib/supabase/proxy.ts — confirm `PROTECTED_PREFIXES` already includes `/biblioteca` and
      `/perfil` even though those pages don't exist in the repo yet. This is intentional forward-wiring
      from a prior change, not something to "fix" — your new Sidebar/menu links to those paths are
      expected to 404 on click until sibling tickets RIK-14/RIK-15 ship, which is acceptable.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna's authenticated zone ((app) route group: /panel, /recomendaciones, /biblioteca, /mis-listas,
    /suscripciones, /importar, /titulo/[slug] when a session exists) has shipped seven feature tickets
    (RIK-6 through RIK-11) with zero shared navigation chrome. app/(app)/layout.tsx today only performs
    the auth redirect and wraps children in UserProvider — there is no Header, no Sidebar, no way to move
    between screens except editing the URL bar. This ticket closes that gap by building the two shared
    layout components the PRD (vistas-y-estilo-rikuna-v2.md Section 1.6) has always specified, and wiring
    them into the one layout file every authenticated route already passes through.

    getCurrentUser() (lib/supabase/server.ts) returns exactly: { id: string, email: string | null,
    fullName: string | null }. There is no avatar-image URL anywhere in this project — the avatar must
    render initials via AvatarFallback only, falling back to email when fullName is null (some accounts
    may never set a display name via Supabase Auth's user_metadata.full_name).

    next-themes is already configured at the root (app/layout.tsx) with enableSystem={false} — there are
    only two themes in play (light, dark), no "system" option, so the theme control this ticket adds is a
    simple flip toggle, not a three-way selector.

    actions/auth/signOut.ts already exists and is fully implemented — a "use server" function that calls
    supabase.auth.signOut() and redirect("/auth/login"). Call it from the avatar menu's "Cerrar sesión"
    item; do not duplicate its logic.

    This ticket is the first of a four-ticket series closing PRD gaps (RIK-12 App shell, RIK-13 Marketing
    home, RIK-14 Mi biblioteca, RIK-15 Perfil). RIK-13's Marketing (unauthenticated) Header/Sidebar variant
    is expected to REUSE the components this ticket builds (with a different user value and a different
    nav item list), so keep Header and Sidebar's props generic (explicit user/items props, no internal
    context reads) rather than hard-coding authenticated-only assumptions into their implementation.
  </context>

  <ground_truth_db_notes critical="true">
    <note>No database work is involved in this ticket — these are codebase ground-truth facts, not schema
      facts, but are just as load-bearing.</note>
    <note>components.json's real "style" value is "base-lyra" (the Base UI variant of shadcn), NOT "lyra"
      as specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 1.3 documents — the project migrated off
      Radix. Add dropdown-menu, sheet, and separator via the shadcn CLI using the project's actual
      configured style; do not hand-write Radix-specific primitive APIs.</note>
    <note>components/ui/avatar.tsx, button.tsx, and tooltip.tsx already exist — do not regenerate or
      overwrite them. dropdown-menu.tsx, sheet.tsx, and separator.tsx do NOT exist yet (confirmed via
      `ls components/ui/`) and must be added.</note>
    <note>app/layout.tsx already wraps the whole app in a single TooltipProvider (from
      components/ui/tooltip.tsx) — do not add a second TooltipProvider in Header or Sidebar; just use
      Tooltip/TooltipTrigger/TooltipContent directly, they will find the existing provider.</note>
    <note>ARCHITECTURE.md's Server Actions table already lists `auth` — "Sign in, sign up, sign out (used
      by the Header's user menu), password reset" — confirming actions/auth/signOut.ts is the intended,
      pre-existing sign-out call site for exactly this ticket's menu item.</note>
    <note>The CurrentUser type has NO avatar-image field. Do not add one, do not fetch a Gravatar or any
      external avatar service — AvatarFallback with computed initials is the complete, intended
      implementation.</note>
    <note>lib/supabase/proxy.ts's PROTECTED_PREFIXES array already includes "/biblioteca" and "/perfil".
      These routes do not have page.tsx files yet — linking the Sidebar/avatar-menu to them is correct and
      intentional; they will 404 on click until RIK-14/RIK-15 ship, which is acceptable and expected, not a
      bug to work around in this ticket.</note>
    <note>app/(app)/layout.tsx's existing redirect() call and UserProvider wrap must remain exactly as
      they are — this ticket only adds Header/Sidebar composition around {children}, it does not restructure
      the guard.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="UI primitives">
      <item>Add dropdown-menu, sheet, and separator via the shadcn CLI using the project's real
        components.json config (style: base-lyra, baseColor: mist, iconLibrary: lucide). Do not hand-author
        these — use the CLI so the generated code matches the Base UI variant exactly.</item>
    </phase>

    <phase title="Constants">
      <item>Create constants/navigation.ts exporting a typed, ordered array of the six authenticated nav
        items, e.g. `export type NavItem = { label: string; href: string; icon: LucideIcon }` and
        `export const APP_NAV_ITEMS: NavItem[] = [...]` with: "Qué ver este mes" -> /panel (Home or
        LayoutDashboard icon), "Recomendaciones" -> /recomendaciones (Sparkles), "Mi biblioteca" ->
        /biblioteca (Library), "Mis listas" -> /mis-listas (ListVideo), "Mis suscripciones" ->
        /suscripciones (Tv), "Importar desde IMDb" -> /importar (Upload). Import icon components from
        lucide-react.</item>
    </phase>

    <phase title="Theme toggle">
      <item>Create components/layout/ThemeToggle.tsx as a Client Component using useTheme() from
        next-themes (already a dependency and already provided at the root). Render a single icon button
        (e.g. Sun/Moon from lucide-react, swapped by resolvedTheme) that flips between "light" and "dark"
        on click — do not add a "system" option, matching the root ThemeProvider's enableSystem={false}.
        This component is designed to be dropped inside a DropdownMenuItem (as the "Cambiar tema" row) in
        Header.tsx.</item>
    </phase>

    <phase title="Sidebar">
      <item>Create components/layout/SidebarNavItem.tsx: a Client Component taking one NavItem plus an
        `collapsed: boolean` prop. Renders a Link styled as a nav row (icon + label), using usePathname()
        to detect whether its own href is the active route (exact match or prefix match for nested routes
        like /mis-listas/[slug] and /importar/[batchId]) and applying a distinct active style/background in
        that case. When collapsed is true, hide the label and wrap the icon-only button in a Tooltip
        showing the label (per PRD 1.6's "Tooltip en modo colapsado").</item>
      <item>Create components/layout/Sidebar.tsx: a Client Component accepting `items: NavItem[]`. Desktop:
        always-visible vertical rail, with a collapse toggle button (chevron icon) that flips local
        useState boolean `collapsed`, animating/resizing width between an expanded and icon-only state,
        rendering each item via SidebarNavItem. Mobile: the SAME item list rendered inside a Sheet whose
        open state is controlled by a prop from Header (`open`, `onOpenChange`) — do not duplicate the
        item-rendering logic between desktop and mobile, extract a shared internal list-rendering
        subcomponent or map if needed, but reuse SidebarNavItem in both.</item>
    </phase>

    <phase title="Header">
      <item>Create components/layout/Header.tsx: a Server Component (no "use client" at the top level)
        accepting `user: CurrentUser` as a prop. Left: Rikuna wordmark/logo as a Link to /panel. Right: on
        mobile, a hamburger IconButton that opens the Sidebar's Sheet (this requires a small client-only
        wrapper around the open/close boolean — extract a client subcomponent, e.g.
        components/layout/MobileNavTrigger.tsx, that owns the useState and renders both the trigger button
        and <Sidebar items={APP_NAV_ITEMS} ... /> in its mobile/Sheet mode, so Header itself can stay a
        Server Component). On the right, an Avatar + DropdownMenu: Avatar shows AvatarFallback with
        initials computed from user.fullName (falling back to user.email when fullName is null; render "?"
        only if both are null, which should not happen for an authenticated user but must not crash).
        DropdownMenu content, top to bottom: a non-interactive header row showing user.fullName ?? "Sin
        nombre" and user.email; DropdownMenuSeparator; a "Perfil" item (Link to /perfil); a "Cambiar tema"
        item embedding ThemeToggle (or triggering the same toggle logic inline — keep it a single click
        target, not a nested menu); DropdownMenuSeparator; a destructive-styled "Cerrar sesión" item that
        is a <form action={signOut}><button type="submit">...</button></form> so the existing Server Action
        fires directly without extra client-side plumbing.</item>
    </phase>

    <phase title="Wire into the layout">
      <item>Modify app/(app)/layout.tsx: after the existing `if (!user) redirect(...)` check, render
        `<UserProvider user={user}>` wrapping a flex layout that composes `<Header user={user} />`, the
        desktop `<Sidebar items={APP_NAV_ITEMS} />`, and `{children}` in a content area (e.g. Sidebar fixed
        to the left on desktop via flex/grid, main content scrollable next to it, Header spanning the top).
        Do not change the guard logic or remove the UserProvider wrap — only add the shell composition
        around what it already renders.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Every route under app/(app)/ (verify with /panel, /recomendaciones,
      /mis-listas, /suscripciones, /importar) renders the Header at the top and the Sidebar on desktop
      viewport widths. Verify: navigate to each route in a desktop-sized browser and confirm both are
      visible.</criterion>
    <criterion id="AC-2">The Sidebar lists exactly the six items from constants/navigation.ts in order,
      each a working Link to its route, and the item matching the current route is visually distinguished
      from the others. Verify: navigate to /panel and confirm only "Qué ver este mes" is highlighted;
      navigate to /suscripciones and confirm only "Mis suscripciones" is highlighted.</criterion>
    <criterion id="AC-3">On desktop, clicking the Sidebar's collapse control switches it to an icon-only
      width and back, and in the collapsed state hovering an icon shows its label in a Tooltip. Verify:
      click the collapse toggle, confirm labels disappear and the rail narrows; hover an icon and confirm a
      Tooltip with the item's label appears.</criterion>
    <criterion id="AC-4">On a mobile-width viewport, the Sidebar is not rendered inline; a hamburger icon
      in the Header opens it as a Sheet sliding in from the side, containing the same six items. Verify:
      resize to a mobile width (e.g. 375px), confirm no inline sidebar, click the hamburger icon, confirm
      the Sheet opens with all six items and each is a working link.</criterion>
    <criterion id="AC-5">Clicking the Avatar opens a DropdownMenu showing (top to bottom): a
      non-interactive row with the user's name and email, a separator, "Perfil", a theme toggle control,
      another separator, and a destructive-styled "Cerrar sesión" item — in that exact order. Verify: open
      the menu as a logged-in user and inspect the rendered order and styling (destructive item visually
      distinct, e.g. red text).</criterion>
    <criterion id="AC-6">Clicking the theme toggle switches the app between light and dark mode
      immediately, and the choice is reflected on next navigation within the same session (next-themes'
      standard class-on-html behavior). Verify: toggle from dark to light, confirm the `class` attribute on
      `&lt;html&gt;` changes and background/foreground colors invert; navigate to another (app) route and
      confirm the chosen theme persists.</criterion>
    <criterion id="AC-7">Clicking "Cerrar sesión" signs the user out and redirects to a login-reachable
      page (per the existing signOut action's behavior, /auth/login), and a subsequent direct navigation to
      /panel redirects back to /auth/login. Verify: click the item, confirm redirect, confirm the Supabase
      session cookie is cleared, confirm /panel now redirects to /auth/login.</criterion>
    <criterion id="AC-8">A user whose fullName is null (only email set) sees valid initials (derived from
      the email) in the Avatar and a valid non-empty label in the dropdown's name row (e.g. falling back to
      the email string) — the UI does not render blank space, "null", or crash. Verify: seed or use a test
      account with no full_name in user_metadata, confirm the Avatar and menu header both render sensible
      fallback text.</criterion>
    <criterion id="AC-9">app/(app)/layout.tsx's existing auth guard is unchanged in behavior — an
      unauthenticated request to any (app) route still redirects to /auth/login before any shell renders.
      Verify: clear the session cookie, request /panel directly, confirm the redirect happens (no flash of
      Header/Sidebar with no user).</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new sign-out action — reuse actions/auth/signOut.ts exactly as it exists
      today.</item>
    <item>Do NOT modify app/(app)/layout.tsx's redirect/guard logic or remove the UserProvider wrap — only
      add shell composition around {children}.</item>
    <item>Do NOT hand-write Radix-based component internals — this project's shadcn style is "base-lyra"
      (Base UI); add dropdown-menu, sheet, and separator via the CLI.</item>
    <item>Do NOT add a "system theme" option — the root ThemeProvider has enableSystem={false}
      deliberately; the new toggle must only flip between "light" and "dark".</item>
    <item>Do NOT invent an avatar-image field or fetch an external avatar service — initials via
      AvatarFallback only, per the real CurrentUser type.</item>
    <item>Do NOT build the /biblioteca or /perfil page bodies — those are RIK-14 and RIK-15. Linking to
      them from the Sidebar/menu is in scope; their content is not.</item>
    <item>Do NOT build the unauthenticated (Marketing) Header/Sidebar variant or touch app/page.tsx —
      that is RIK-13. Do keep Header/Sidebar's props (user, items) generic enough that RIK-13 can reuse
      them without modification.</item>
    <item>Do NOT add a second TooltipProvider — app/layout.tsx already provides one globally.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
    <item>Do not touch font-family/typography configuration (app/layout.tsx's font variables,
      globals.css font tokens) — explicitly out of scope for this ticket per the requester.</item>
  </constraints>

  <out_of_scope>
    <item>Marketing (unauthenticated) Header/Sidebar variant and the `/` page — RIK-13, which depends on
      this ticket's components.</item>
    <item>/biblioteca and /perfil page content — RIK-14 and RIK-15.</item>
    <item>Persisting sidebar collapse state across page reloads (localStorage/cookie) — cheap follow-up,
      not required by the PRD's stated behavior.</item>
    <item>Changing signOut's redirect target from /auth/login to / — flagged as a possible follow-up if
      the PRD's literal wording is confirmed as intentional, not done here.</item>
    <item>Any change to middleware.ts, lib/supabase/proxy.ts, or PROTECTED_PREFIXES — already correctly
      configured.</item>
    <item>Font family / typography — explicitly excluded from this whole gap-analysis pass by the
      requester.</item>
  </out_of_scope>

  <implementation_notes>
    <item>constants/navigation.ts — `export type NavItem = { label: string; href: string; icon:
      import("lucide-react").LucideIcon }`.</item>
    <item>components/layout/SidebarNavItem.tsx — `export function SidebarNavItem({ item, collapsed }: {
      item: NavItem; collapsed: boolean })`.</item>
    <item>components/layout/Sidebar.tsx — `export function Sidebar({ items, mobile, open, onOpenChange }: {
      items: NavItem[]; mobile?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void })` or an
      equivalent split into two small components (e.g. SidebarDesktop / SidebarMobileSheet) sharing
      SidebarNavItem — pick whichever keeps Header a Server Component, since the mobile trigger's open
      state must live in a Client Component.</item>
    <item>components/layout/Header.tsx — `export function Header({ user }: { user: CurrentUser })`.</item>
    <item>components/layout/ThemeToggle.tsx — `"use client"`, `const { resolvedTheme, setTheme } =
      useTheme()`, `setTheme(resolvedTheme === "dark" ? "light" : "dark")`.</item>
    <item>Local initials helper in Header.tsx, mirroring features/title/CastList.tsx's algorithm: split on
      spaces, take up to 2 parts, first letter of each, uppercased, joined; fall back to the first
      character of the email (uppercased) when fullName is null.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created and wired end-to-end into
      app/(app)/layout.tsx.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether signOut should redirect to "/" instead of "/auth/login" to match the PRD's literal
      wording. Default if unconfirmed: leave actions/auth/signOut.ts untouched (redirects to
      /auth/login).</item>
    <item>Exact icon choice for "Qué ver este mes" — PRD suggests Home or LayoutDashboard. Default if
      unconfirmed: Home (matches the "landing page after login" framing more directly).</item>
    <item>Whether the sidebar collapse control lives inside the Sidebar itself or in the Header. Default if
      unconfirmed: inside Sidebar, as a small chevron button at its own top/bottom edge, since it is
      Sidebar-local state.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-9): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-12: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-12_app_shell_navigation.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to app_shell_navigation, matching specs/backlog/RIK-12_app_shell_navigation.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-12_app_shell_navigation.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: components / constants / app routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
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
      <item>NON-TECHNICAL: no file paths, no column or type names, no framework or library names. Translate them into product language (say "the navigation menu" instead of naming the component, "the account menu" instead of "DropdownMenu").</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots: list 3-4 numbered items, each with screen/area name and what it should show — e.g. "Desktop panel with sidebar expanded", "Desktop sidebar collapsed showing icon-only rail", "Mobile view with the navigation menu open", "Account menu open showing name, profile link, theme toggle, and sign out". Prefix each with `[attach: short label]`.</item>
      <item>Do NOT embed images — attachments are added by the human.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is UI-focused: include "## Prerequisites" (dev server running, a logged-in test user; optionally one with no display name set to check the fallback), then "## UI validation" with numbered steps covering: desktop navigation across all six sidebar items and the active-route highlight, sidebar collapse/expand with tooltip check, mobile viewport hamburger-to-Sheet flow, the avatar menu's full content and order, the theme toggle's visual effect and persistence across navigation, and sign-out followed by a direct /panel request confirming the redirect.</item>
      <item>Then "## Expected outcome" (bullets tying back to AC-1 through AC-9).</item>
      <item>Use concrete app paths: /panel, /recomendaciones, /biblioteca, /mis-listas, /suscripciones, /importar.</item>
      <item>No database validation section — this ticket has no schema/data component.</item>
    </deliverable>
  </completion_report>
</task>
```

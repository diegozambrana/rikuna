# RIK-15 — Perfil / cuenta

> Documento de lectura. La fuente de verdad es [`RIK-15_perfil_cuenta.md`](./RIK-15_perfil_cuenta.md).

## Resumen del ticket

Construir `/perfil`, el más pequeño de los cuatro tickets de vacíos del PRD en esta serie: un resumen de cuenta de solo lectura (nombre, correo), un `Switch` de tema claro/oscuro, y un botón destructivo "Cerrar sesión" — todo construido enteramente sobre datos y acciones que ya existen (`useSession()`/`UserProvider`, `next-themes`, `actions/auth/signOut.ts`).

- Sin servicio, acción, ni trabajo de base de datos nuevos — este ticket es puramente de presentación, componiendo piezas existentes sobre una ruta nueva.
- `/perfil` ya está enlazado desde el menú del avatar (RIK-12) y ya está protegido a nivel middleware (`PROTECTED_PREFIXES` de `lib/supabase/proxy.ts` ya lo incluye) — este ticket es el cuerpo de página faltante al que esos ya apuntan.
- No hay comentarios de equipo — derivado del mismo análisis de vacíos que RIK-12/RIK-13/RIK-14. La familia tipográfica queda explícitamente fuera de alcance por pedido del solicitante.

---

## Contexto

### Ticket original

No existe un ticket de tracker para este trabajo; se definió comparando directamente `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` Sección 2.2 ("`/perfil` — Perfil / cuenta") contra el repositorio real — confirmado vía `find`/`grep` que no existe ningún directorio `app/(app)/perfil/` ni `features/profile/` en ningún lado.

Requisitos del PRD incorporados aquí (Sección 2.2, intención verbatim):

- **Contenido:** datos de la cuenta (nombre, correo), preferencias (tema claro/oscuro, si se permite cambiar), cerrar sesión.
- **Componentes sugeridos:** `Form` simple, `Switch` para tema, `Button` destructivo para cerrar sesión.

### Comentarios del equipo

Ninguno — ver "Ticket original" arriba.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el código | Impacto |
| --- | --- | --- |
| El texto "Form simple" del PRD podría implicar campos editables de nombre/correo | No existe ninguna acción de actualización de perfil en ningún lado (`grep -r "updateProfile\|updateUser" actions/` no devuelve nada más allá de la contraseña), y la propia lista de campos del PRD ("datos de la cuenta: nombre, correo") no exige explícitamente que sean editables — solo `/auth/update-password` (ya entregado en RIK-2) edita credenciales de la cuenta | Este ticket renderiza nombre/correo como visualización de **solo lectura**, no como un formulario de edición (ver Decisiones) |
| El PRD da a entender que podría existir un submenú de tema ("tema claro/oscuro si se permite cambiar") | `app/layout.tsx` configura `next-themes` con `enableSystem={false}` — solo hay dos temas en juego siempre; RIK-12 ya construyó un `ThemeToggle` de botón-ícono para el menú del avatar usando el mismo hook `useTheme()` | Este ticket necesita su propio control con forma de `Switch` (el componente sugerido explícito del PRD para esta pantalla) usando el mismo hook `useTheme()`, no una copia del componente de botón-ícono de RIK-12 — mismo estado subyacente, forma de presentación distinta para un contexto distinto |
| El PRD no menciona la infraestructura de cierre de sesión existente | `actions/auth/signOut.ts` ya existe y está completamente implementada (`supabase.auth.signOut()` + `redirect("/auth/login")`), ya reutilizada por el menú del avatar de RIK-12 | Reutilizarla una segunda vez aquí; no escribir una tercera implementación de cierre de sesión |
| El PRD Sección 2.2 agrupa `/perfil` bajo "Zona App (requiere sesión)" como si necesitara lógica nueva de obtención de sesión | `getCurrentUser()` (servidor) y `useSession()`/`useUserContext()` (cliente, respaldado por `UserProvider`, ya hidratado por `app/(app)/layout.tsx` para cada ruta autenticada) ya proveen `id`, `email`, `fullName` | Este ticket lee el contexto de cliente ya hidratado (`useSession()`) en vez de emitir una segunda llamada redundante a `getCurrentUser()` del lado del servidor dentro de la página |

### Estado actual en la base de datos

No aplica — este ticket no realiza ninguna lectura ni escritura más allá de lo que `getCurrentUser()`/`signOut()` ya hacen. `CurrentUser` (`lib/supabase/server.ts`) sigue siendo la única forma relevante: `{ id: string; email: string | null; fullName: string | null }`.

### Lógica actual (perfil)

No hay implementación existente — confirmado vía `find app/\(app\)/perfil`, `find features/profile`, ambos sin resultados. El `PROTECTED_PREFIXES` de `lib/supabase/proxy.ts` ya incluye `/perfil` (agregado antes de este ticket junto con el trabajo de shell de RIK-12), así que la ruta ya está protegida a nivel middleware una vez que la página exista. El menú del avatar de `Header` de RIK-12 ya renderiza un `Link` "Perfil" a esta ruta.

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| Nombre | texto (visualización) | `CurrentUser.fullName` (nullable) | ya existe (reutilizar) |
| Correo | texto (visualización) | `CurrentUser.email` (nullable) | ya existe (reutilizar) |
| Tema claro/oscuro | toggle booleano | `useTheme()` de `next-themes` (`resolvedTheme`/`setTheme`), la misma fuente que ya usa el `ThemeToggle` de RIK-12 | ya existe (reutilizar) |
| Cerrar sesión | acción | `actions/auth/signOut.ts` | ya existe (reutilizar) |

Sin migración, sin servicio nuevo, sin acción nueva.

### Archivos impactados

**Rutas de app**
- `app/(app)/perfil/page.tsx` — nuevo. Server Component delgado que renderiza `features/profile/ProfileScreen`.

**Features**
- `features/profile/ProfileScreen.tsx` — nuevo. Client Component: lee `useSession()` para `user`, renderiza el bloque de info de cuenta, `ThemeSwitch`, y el formulario de cierre de sesión.
- `features/profile/ThemeSwitch.tsx` — nuevo. Client Component: un `Switch` conectado a `useTheme()`, distinto (aunque funcionalmente equivalente en estado) al botón-ícono `components/layout/ThemeToggle.tsx` de RIK-12.

**Sin cambios** en `services/`, `actions/` (más allá de importar el `signOut` existente), `types/`, `components/layout/` (el enlace existente a `/perfil` del `Header` de RIK-12 no necesita cambios — ya apunta aquí), ni ningún archivo de `supabase/migrations/`.

### Decisiones tomadas

1. **Nombre/correo se renderizan como texto de solo lectura, no como un formulario editable.** Razón: no existe ninguna acción de servidor de actualización de perfil en ningún lado del código, y construir una (más su conexión con `auth.updateUser()`, validación y revalidación) es un alcance significativamente mayor de lo que la entrada del PRD "Perfil / cuenta" implica para esta pasada — la propia sugerencia de componente del PRD ("Form simple") es ambigua sobre la editabilidad y no la lista como requisito junto al `Switch` de tema y el `Button` de cierre de sesión. Default recomendado, no confirmado — marcado en `<clarify_before_coding>`; el nombre editable es un follow-up limpio si se confirma que se quiere.
2. **Un nuevo componente `ThemeSwitch` (con forma de Switch), no una reutilización del `ThemeToggle` de RIK-12 (con forma de botón-ícono).** Razón: el PRD Sección 1.5 mapea explícitamente "`/perfil`" preferencias a `Switch`, mientras que la Sección 1.6 describe el control de tema del menú del avatar como "toggle inline o submenú" — dos formas sugeridas distintas para el mismo valor booleano de dos estados de next-themes. Ambos son componentes simples de un solo hook; forzar a uno a renderizarse con la forma del otro (o construir un componente compartido con una prop de variante para un solo booleano) es más complejidad que la duplicación que ahorraría. Default recomendado.
3. **Leer los datos de sesión vía el hook de cliente `useSession()`/`useUserContext()` ya hidratado, no una segunda llamada a `getCurrentUser()` del lado del servidor dentro de `page.tsx`.** Razón: `app/(app)/layout.tsx` (RIK-12) ya obtiene el usuario una vez por request e hidrata `UserProvider` para cada ruta autenticada; volver a obtenerlo en `page.tsx` sería un round trip redundante para datos ya en contexto. Default recomendado.

### Fuera de alcance

- Campos editables de nombre/correo y cualquier acción de servidor `updateProfile` correspondiente — marcado como follow-up si se confirma que se quiere (ver Decisión 1).
- Subida de imagen de avatar — no existe ningún campo de imagen de avatar en ningún lado del proyecto (confirmado en la investigación de RIK-12); fuera de alcance aquí también.
- Eliminación de cuenta — no mencionada en ningún lado del PRD para esta pantalla.
- Familia tipográfica — explícitamente excluida de todo este análisis de vacíos por el solicitante.

---

## Plan de implementación

**Objetivo:** Entregar `/perfil` como el cuarto y último vacío del PRD en esta serie — el más pequeño de los cuatro, componiendo solo datos de sesión, theming y infraestructura de cierre de sesión ya existentes sobre una ruta nueva.

**En alcance:**
1. `features/profile/ThemeSwitch.tsx` — `Switch` conectado a `useTheme()`.
2. `features/profile/ProfileScreen.tsx` — info de cuenta (solo lectura) + `ThemeSwitch` + formulario de cierre de sesión.
3. `app/(app)/perfil/page.tsx` — envoltorio de ruta delgado.

**Fuera de alcance:** campos de perfil editables, subida de avatar, eliminación de cuenta, familia tipográfica — ver Fuera de alcance arriba.

**Riesgos clave / compatibilidad:** mínimos — este ticket agrega una ruta nueva y dos componentes de presentación nuevos, sin tocar ningún archivo compartido salvo por adición (el comportamiento de ningún archivo existente cambia). La única dependencia compartida es `useSession()`, usada aquí solo de lectura.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | Bloque de info de cuenta de `ProfileScreen`, `useSession()` |
| AC-2 | `ThemeSwitch` |
| AC-3 | Formulario de cierre de sesión llamando a `actions/auth/signOut.ts` |
| AC-4 | Renderizado de respaldo de `useSession()` para un `fullName` nulo |

---

## Prompt para Claude Code

```xml
<task id="RIK-15" title="Perfil / cuenta">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full. Its Features table already lists a `profile` entry: "Account
      settings, theme toggle" — this ticket implements exactly that scope, no more.</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data; no
      dynamic-route or server-action specifics are unusual for this ticket, but confirm current App Router
      conventions for a simple page.tsx if anything looks unfamiliar.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 2.2 ("/perfil — Perfil / cuenta") — the
      full content spec: account data fields, theme preference, sign out, suggested components (Form,
      Switch, destructive Button).</item>
    <item>components/providers/UserProvider.tsx and hooks/useSession.ts — the existing client
      context/hook this ticket reads from (`user`, `isAuthenticated`). Do not add a second context
      provider or a redundant server-side session fetch in the new page.</item>
    <item>lib/supabase/server.ts — the CurrentUser type (`id`, `email`, `fullName`, all but `id`
      nullable) this ticket displays.</item>
    <item>actions/auth/signOut.ts and actions/auth/index.ts — the existing, already-implemented sign-out
      Server Action. Reuse it exactly as-is; do not write a second or third sign-out
      implementation.</item>
    <item>app/layout.tsx — the root `ThemeProvider` config (`attribute="class" defaultTheme="dark"
      enableSystem={false}`) from `next-themes` — only two themes are ever in play.</item>
    <item>components/layout/ThemeToggle.tsx (from RIK-12, if already landed) — read it for the exact
      `useTheme()` API usage (`resolvedTheme`, `setTheme`), but do NOT import or reuse this component
      directly — this ticket builds a separate Switch-shaped control against the same hook, per PRD
      1.5's explicit Switch suggestion for this screen (see ground truth notes for why).</item>
    <item>components/ui/switch.tsx and components/ui/button.tsx — existing primitives to reuse as-is; no
      new shadcn primitives are needed for this ticket.</item>
    <item>lib/supabase/proxy.ts — confirm /perfil is already in PROTECTED_PREFIXES (it is); no middleware
      change is needed for this ticket.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    /perfil is the smallest of a four-ticket series closing gaps between the shipped app and
    specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md (RIK-12 App shell, RIK-13 Marketing home, RIK-14 Mi
    biblioteca, RIK-15 this ticket). It needs no new service, action, or database work — only a new route
    composing three things that already exist: the authenticated user's name/email (via the existing
    useSession()/UserProvider context, already hydrated by app/(app)/layout.tsx for every authenticated
    route), a light/dark theme control (next-themes' useTheme(), already configured at the root with
    enableSystem={false} — there are only two themes, never a "system" option), and sign-out
    (actions/auth/signOut.ts, already implemented and already used by RIK-12's avatar menu).

    The PRD's content list for this screen is: account data (name, email), theme preference, sign out. Its
    suggested components are a simple Form, a Switch for the theme, and a destructive Button for sign out.
    No update-profile action exists anywhere in this codebase — this ticket renders name/email as
    read-only display text, not an editable form (see the out-of-scope note below); building
    edit-and-persist for the account name is a larger, separate scope this ticket does not take on.
  </context>

  <ground_truth_db_notes critical="true">
    <note>No database work is involved in this ticket — these are codebase ground-truth facts, not schema
      facts, but are just as load-bearing.</note>
    <note>There is no updateProfile/updateUser server action anywhere in actions/ (confirmed via repo-wide
      grep) — do not assume one exists or invent an edit form that would need one. Name and email render
      as plain read-only text.</note>
    <note>useSession() (hooks/useSession.ts) returns { user: CurrentUser | null, isAuthenticated: boolean
      } by reading UserProvider's context, which app/(app)/layout.tsx already hydrates with a
      non-null CurrentUser for every authenticated route (the layout redirects to /auth/login otherwise).
      Inside this ticket's page, user will never be null in practice, but the hook's type is still
      CurrentUser | null — handle it defensively (e.g. render nothing or a loading fallback if somehow
      null, but do not assume a runtime crash is impossible) rather than force-unwrapping it.</note>
    <note>next-themes is configured at the root (app/layout.tsx) with enableSystem={false} — build the
      Switch as a simple two-state (light/dark) control, not a three-way selector.</note>
    <note>components/layout/ThemeToggle.tsx (RIK-12) is an icon-button, not a Switch — this ticket's
      Switch-shaped control is a SEPARATE small component reading the same useTheme() hook, per PRD
      Section 1.5's explicit "Switch para tema" suggestion for THIS screen specifically (Section 1.6
      separately describes the avatar menu's control as "toggle inline o submenú" — a different shape for
      a different context). Do not try to make one component serve both shapes via a variant prop; two
      small, independent components is simpler here.</note>
    <note>actions/auth/signOut.ts already exists and is fully implemented (supabase.auth.signOut() then
      redirect("/auth/login")) and is already used by RIK-12's avatar menu (if RIK-12 has landed) — call it
      via the same `<form action={signOut}>` pattern, do not write new sign-out logic.</note>
    <note>lib/supabase/proxy.ts's PROTECTED_PREFIXES already includes "/perfil" — no middleware change is
      needed; the route is already guarded once app/(app)/perfil/page.tsx exists.</note>
    <note>components/ui/switch.tsx and components/ui/button.tsx already exist — no new shadcn primitives
      are required for this ticket.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="Theme control">
      <item>Create features/profile/ThemeSwitch.tsx as a Client Component using useTheme() from
        next-themes. Render a labeled Switch ("Modo oscuro" or similar copy) whose checked state reflects
        resolvedTheme === "dark", calling setTheme("dark" | "light") on toggle. Do not add a "system"
        option.</item>
    </phase>

    <phase title="Profile screen">
      <item>Create features/profile/ProfileScreen.tsx as a Client Component. Read `const { user } =
        useSession()`. Render: an account-info block showing user?.fullName ?? "Sin nombre" and
        user?.email (both read-only text, no input fields); the ThemeSwitch; and a destructive-styled
        "Cerrar sesión" control implemented as `<form action={signOut}><Button type="submit"
        variant="destructive">Cerrar sesión</Button></form>` (import signOut from
        actions/auth). If user is null (defensive only — should not occur in practice per the ground truth
        notes), render nothing or a minimal fallback rather than crashing on a property access.</item>
    </phase>

    <phase title="Route">
      <item>Create app/(app)/perfil/page.tsx as a thin Server Component (or a simple default export)
        rendering `<ProfileScreen />` — no data fetching of its own; all data comes from the already-
        hydrated client context inside ProfileScreen.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Navigating to /perfil while authenticated shows the current user's name (or a
      graceful fallback when fullName is null) and email as read-only text. Verify: log in, navigate to
      /perfil, confirm both fields render with the correct values for the logged-in account.</criterion>
    <criterion id="AC-2">Toggling the theme Switch immediately flips the app between light and dark mode,
      matching the same underlying state RIK-12's avatar-menu theme control uses (toggling one is reflected
      by the other on next render/navigation). Verify: toggle the Switch, confirm the `class` attribute on
      `&lt;html&gt;` changes and colors invert; if RIK-12 has landed, open the avatar menu and confirm its
      theme control reflects the same state.</criterion>
    <criterion id="AC-3">Clicking "Cerrar sesión" signs the user out (via the existing signOut action) and
      redirects to /auth/login; a subsequent direct request to /perfil then redirects back to
      /auth/login. Verify: click the button, confirm redirect and cleared session cookie, confirm /perfil
      now redirects to /auth/login.</criterion>
    <criterion id="AC-4">A user whose fullName is null renders a sensible fallback (e.g. "Sin nombre")
      instead of blank space, "null", or a crash. Verify: use/seed a test account with no full_name in
      user_metadata, confirm the name field shows the fallback text and email still renders
      correctly.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT build an editable name/email form or any updateProfile/updateUser server action — read-
      only display only, per Decision 1.</item>
    <item>Do NOT create a new sign-out action — reuse actions/auth/signOut.ts exactly as it exists
      today.</item>
    <item>Do NOT import or reuse components/layout/ThemeToggle.tsx directly — build a separate
      Switch-shaped component against the same useTheme() hook.</item>
    <item>Do NOT add a "system theme" option — enableSystem={false} at the root is deliberate.</item>
    <item>Do NOT add avatar image upload or account deletion — not requested by the PRD for this
      screen.</item>
    <item>Do NOT perform a redundant server-side getCurrentUser() call inside the new page — read from the
      already-hydrated useSession()/UserProvider context instead.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
    <item>Do not touch font-family/typography configuration — explicitly out of scope for this ticket per
      the requester.</item>
  </constraints>

  <out_of_scope>
    <item>Editable name/email fields and any corresponding updateProfile action — follow-up candidate if
      confirmed wanted (see Decision 1 / clarify_before_coding).</item>
    <item>Avatar image upload — no such field exists anywhere in the project.</item>
    <item>Account deletion — not mentioned by the PRD for this screen.</item>
    <item>Font family / typography — explicitly excluded from this whole gap-analysis pass by the
      requester.</item>
  </out_of_scope>

  <implementation_notes>
    <item>features/profile/ThemeSwitch.tsx — `"use client"`, `const { resolvedTheme, setTheme } =
      useTheme()`, `&lt;Switch checked={resolvedTheme === "dark"} onCheckedChange={(checked) =>
      setTheme(checked ? "dark" : "light")} /&gt;`.</item>
    <item>features/profile/ProfileScreen.tsx — `"use client"`, `const { user } = useSession()`.</item>
    <item>app/(app)/perfil/page.tsx — `export default function PerfilPage() { return &lt;ProfileScreen
      /&gt; }`.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created and wired end-to-end.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether name/email should be editable in this ticket after all (the PRD's "Form simple" wording
      is ambiguous). Default if unconfirmed: read-only display only; editable fields become a follow-up
      ticket with its own updateProfile server action.</item>
    <item>Exact Spanish copy for the theme Switch's label. Default if unconfirmed: "Modo oscuro".</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-4): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-15: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-15_perfil_cuenta.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to perfil_cuenta, matching specs/backlog/RIK-15_perfil_cuenta.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-15_perfil_cuenta.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: features / app routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
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
      <item>NON-TECHNICAL: no file paths, no type names, no framework or library names. Translate them into product language (say "the account page" instead of naming the route, "the theme switch" instead of naming the component).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots: list 1-2 numbered items — e.g. "Account page showing name, email, theme switch, and sign out". Prefix each with `[attach: short label]`.</item>
      <item>Do NOT embed images — attachments are added by the human.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is UI-focused: include "##
        Prerequisites" (dev server running, a logged-in test user; optionally one with no display name
        set to check the fallback), then "## UI validation" with numbered steps covering: viewing the
        account info, toggling the theme switch and confirming the visual effect, and signing out followed
        by a direct /perfil request confirming the redirect.</item>
      <item>Then "## Expected outcome" (bullets tying back to AC-1 through AC-4).</item>
      <item>Use concrete app paths: /perfil, /auth/login.</item>
      <item>No database validation section — this ticket has no schema/data component.</item>
    </deliverable>
  </completion_report>
</task>
```

# RIK-13 — Inicio (Marketing home)

> Documento de lectura. La fuente de verdad es [`RIK-13_marketing_home.md`](./RIK-13_marketing_home.md).

## Resumen del ticket

Reemplazar el placeholder de `create-next-app` en `/` con la página de inicio real de Rikuna: un Hero (nombre, tagline, dos CTAs), una sección "Cómo funciona" de 4 pasos, una sección de confianza que explica el enfoque basado en IMDb, y un footer mínimo — más un redirect consciente de sesión para que un visitante ya logueado llegue directo a `/panel` en vez de ver la página de marketing.

- `app/page.tsx` hoy es 100% boilerplate de `create-next-app` sin tocar (logos de Next.js/Vercel, texto "To get started, edit page.tsx") — este ticket es un reemplazo completo, no una edición.
- Mueve la ruta a un nuevo grupo de rutas `(marketing)` según la estructura objetivo ya documentada en `ARCHITECTURE.md`, con su propio layout que renderiza la variante **sin sesión** de Header/Sidebar construida en RIK-12 — este ticket depende (`depends_on`) de RIK-12 para que esos componentes existan.
- El contenido se basa en `specs/RIKUNA-PRD-documento-especificacion-rikuna.md` (Secciones 1 y 5): el tagline con origen quechua, la propuesta de valor del cruce de tres conjuntos de datos, y el ángulo de confianza "parte de tu historial real de IMDb" — no es copy inventado.
- No hay comentarios de equipo — derivado del mismo análisis de vacíos que RIK-12 (ver el "Ticket original" de RIK-12 para cómo se definió la serie de cuatro tickets). La familia tipográfica queda explícitamente fuera de alcance por pedido del solicitante.

---

## Contexto

### Ticket original

No existe un ticket de tracker para este trabajo; se definió comparando directamente `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` Sección 2.0 ("Zona Marketing — `/` Inicio") contra el `app/page.tsx` real, que sigue siendo la página de inicio de Next.js sin modificar.

Requisitos del PRD incorporados aquí (Sección 2.0, intención verbatim):

- **Propósito:** página de entrada para cualquiera que llegue sin sesión (hoy este vacío simplemente no existía). Si el visitante ya tiene sesión iniciada, redirige directo a `/panel` en vez de mostrar esta página.
- **Hero:** nombre "Rikuna" + significado ("lo que se debe ver", quechua), propuesta de valor en una línea, dos botones ("Crear cuenta", "Iniciar sesión").
- **Cómo funciona (3-4 pasos):** importa tu historial de IMDb → indica tu servicio activo → recibe tu lista del mes → descubre algo nuevo bien calificado.
- **Sección de confianza:** breve mención de que los datos parten de calificaciones reales del usuario en IMDb, no de un algoritmo genérico.
- **Footer simple:** enlace a login/registro, nada más — no hay contenido legal/corporativo definido todavía.
- **Layout:** Marketing (Header + Sidebar, variante sin sesión, según Sección 1.6 — construida en RIK-12, reutilizada aquí).
- **Componentes sugeridos:** secciones apiladas con `Card` o bloques simples, `Button` para los CTA, íconos Lucide por paso.

### Comentarios del equipo

Ninguno — ver "Ticket original" arriba.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| El ticket dice | Realidad en el código | Impacto |
| --- | --- | --- |
| El PRD describe `/` como un vacío por llenar | `app/page.tsx` existe pero es exactamente el starter de `create-next-app` sin tocar (logo de Next.js, CTA de deploy de Vercel, enlaces "Learn") — confirmado leyendo el archivo completo | Este es un reemplazo completo del contenido del archivo, no una edición incremental; nada del archivo actual se reutiliza |
| El PRD Sección 2.2 lista `/panel` como "ya no es `/`" (dando a entender que `/` solía ser la página de aterrizaje) | `app/(app)/panel/page.tsx` ya existe como ruta propia, sin verse afectada por este ticket — `/` y `/panel` siempre fueron rutas físicas separadas en este código, no hay comportamiento legacy de `/` del cual migrar | No se necesita trabajo de migración; esto es aditivo |
| `ARCHITECTURE.md` (sin commitear, modificado) ya documenta un grupo de rutas `(marketing)`: `app/(marketing)/page.tsx` → `/`, "Redirects to /panel if a session already exists" | No existe ningún grupo de rutas `(marketing)` todavía; `app/page.tsx` está directamente bajo `app/` sin ningún grupo de rutas, heredando solo el layout raíz | Este ticket crea `app/(marketing)/` y mueve el archivo ahí — los grupos de rutas de Next.js no afectan la URL, así que `/` sigue siendo `/` |
| El PRD da a entender que el redirect por sesión ocurre "automáticamente" | El `AUTH_ONLY_PATHS` de `lib/supabase/proxy.ts` (redirect a nivel middleware para usuarios autenticados) hoy solo lista `/auth/login` y `/auth/sign-up` — `/` no está en esa lista, así que hoy un visitante autenticado a `/` vería la página de marketing (actualmente rota), sin redirect a nivel middleware | Este ticket debe agregar la lógica de redirect él mismo — ya sea extendiendo `AUTH_ONLY_PATHS` para incluir `/`, con un chequeo de Server Component en el nuevo `(marketing)/layout.tsx`, o ambos (ver Decisiones) |
| El PRD Sección 1.6 describe el Header/Sidebar de Marketing como si fueran componentes independientes | La sección de UI compartida de `ARCHITECTURE.md` afirma: "Both [Header and Sidebar] render in `(marketing)` and `(app)`" — es decir, los MISMOS componentes, no un conjunto paralelo | Este ticket debe reutilizar `components/layout/Header.tsx` / `Sidebar.tsx` de RIK-12, extendiendo sus tipos de props para el caso sin sesión en vez de construir componentes nuevos |

### Estado actual en la base de datos

No aplica — este ticket es puramente de presentación; lee el estado de sesión (vía `getCurrentUser()`, ya implementado) pero no escribe nada ni toca ninguna tabla.

### Lógica actual (`app/page.tsx`)

Verbatim (abreviado), el archivo completo hoy:

```tsx
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 ...">
        <Image src="/next.svg" alt="Next.js logo" ... />
        <div>
          <h1>To get started, edit the <code>page.tsx</code> file.</h1>
          <p>Looking for a starting point ... Templates ... Learning center.</p>
        </div>
        <div>
          <a href="https://vercel.com/new?...">Deploy Now</a>
          <a href="https://nextjs.org/docs?...">Documentation</a>
        </div>
      </main>
    </div>
  );
}
```

No realiza ningún chequeo de sesión, no tiene Header/Sidebar (no está dentro de ningún grupo de rutas), y referencia `public/next.svg` y `public/vercel.svg` — los únicos dos archivos en todo el repo que importan esos assets (confirmado vía `grep`). Nada de la estructura, estilos o lógica de este archivo se conserva.

### Mapeo de campos solicitados

No aplica — sin campos persistidos. La única dependencia de datos de este ticket es `getCurrentUser(): Promise<CurrentUser | null>` (`lib/supabase/server.ts`), ya implementado y reutilizado tal cual.

### Archivos impactados

**Rutas de app**
- `app/(marketing)/page.tsx` — nuevo. El contenido real de Hero/Cómo funciona/confianza/footer, reemplazando `app/page.tsx`.
- `app/(marketing)/layout.tsx` — nuevo. Chequeo de sesión (`getCurrentUser()`), `redirect("/panel")` si hay sesión, si no renderiza `Header`/`Sidebar` (variante sin sesión) + `{children}`.
- `app/page.tsx` — **eliminado**. Su contenido se mueve a `app/(marketing)/page.tsx`; Next.js resuelve ambos a la misma URL `/`, y tenerlos simultáneamente sería una colisión de rutas.

**Componentes (modificados, de RIK-12)**
- `components/layout/Header.tsx` — extender el tipo de la prop `user` de `CurrentUser` a `CurrentUser | null`; cuando es `null`, renderizar botones "Iniciar sesión"/"Crear cuenta" en vez del avatar/menú desplegable, según la columna "Sin sesión" de la Sección 1.6 del PRD.
- `components/layout/Sidebar.tsx` — sin cambio de tipos necesario; reutilizado tal cual con un array `items` distinto (ver abajo). Su resaltado de ruta activa es un no-op para ítems de ancla, lo cual se acepta como simplificación (ver Decisiones).

**Constantes (nuevas)**
- `constants/marketingNavigation.ts` — la lista de ítems de navegación de la variante sin sesión: "Inicio" (`#inicio`), "Cómo funciona" (`#como-funciona`), "Iniciar sesión" (`/auth/login`), "Crear cuenta" (`/auth/sign-up`) — refleja la forma `NavItem` de `constants/navigation.ts` de RIK-12 para que `Sidebar`/`SidebarNavItem` no necesiten más cambios.

**Features (nuevos)**
- `features/marketing/Hero.tsx` — nombre, tagline, dos botones CTA.
- `features/marketing/HowItWorks.tsx` — lista de 4 pasos con íconos Lucide, anclada en `#como-funciona`.
- `features/marketing/TrustSection.tsx` — nota breve de confianza sobre datos con origen en IMDb.
- `features/marketing/MarketingFooter.tsx` — footer mínimo, solo enlaces de login/registro.

**Config (modificado)**
- `lib/supabase/proxy.ts` — agregar `"/"` a `AUTH_ONLY_PATHS` para que un visitante autenticado sea redirigido a nivel middleware, no solo después de un ciclo de render completo (ver Decisiones).

**Sin cambios** en `services/`, `actions/`, `types/`, ni ningún archivo de `supabase/migrations/`. `public/next.svg` / `public/vercel.svg` quedan sin uso pero se dejan en su lugar (inofensivo; no es parte del alcance de este ticket depurar assets del starter).

### Decisiones tomadas

1. **`AUTH_ONLY_PATHS` gana `"/"` (redirect a nivel middleware) Y `(marketing)/layout.tsx` mantiene su propio chequeo con `getCurrentUser()` (belt-and-suspenders a nivel Server Component).** Razón: refleja exactamente el patrón que el propio comentario de `app/(app)/layout.tsx` ya documenta en la dirección opuesta — "Server Functions bypass proxy matchers, so this Server Component check is the real backstop." El redirect de middleware es el camino rápido; el chequeo de layout es corrección bajo todas las circunstancias. Default recomendado, no confirmado — marcado en `<clarify_before_coding>` porque toca un archivo compartido ya correcto.
2. **La prop `user` de `Header` pasa a ser `CurrentUser | null`, extendiendo el componente de RIK-12 en vez de bifurcar uno segundo.** Razón: `ARCHITECTURE.md` afirma explícitamente que Header/Sidebar se renderizan tanto en `(marketing)` como en `(app)` — un `MarketingHeader` paralelo contradiría eso y duplicaría la superficie de mantenimiento por la diferencia de un logo + un clúster de enlaces. Default recomendado.
3. **La lista de ítems del Sidebar sin sesión usa hrefs de ancla en la misma página (`#inicio`, `#como-funciona`) para los primeros dos ítems, y rutas reales para los últimos dos ("Iniciar sesión" → `/auth/login`, "Crear cuenta" → `/auth/sign-up`).** Razón: coincide exactamente con la tabla del sidebar sin sesión de la Sección 1.6 del PRD ("Inicio: Ancla al tope de la propia página"; "Cómo funciona: Ancla a la sección correspondiente"). El resaltado de ruta activa vía `usePathname()` (construido en RIK-12) no tiene sentido para ítems de ancla y se acepta como un no-op conocido para esas dos filas — no vale la pena crear un caso especial en `SidebarNavItem` para una página que siempre es `/`. Default recomendado.
4. **No se necesitan primitivas de UI nuevas.** `Card`, `Button` y el set de íconos Lucide ya están disponibles (`Button` desde el inicio del proyecto; `Card` agregado en RIK-9). Confirmado vía `ls components/ui/`.
5. **El copy se escribe a partir de `specs/RIKUNA-PRD-documento-especificacion-rikuna.md` Secciones 1 y 5**, no inventado: el significado quechua ("lo que se debe ver"), el planteamiento de la pregunta central ("este mes contraté tal servicio de streaming, ¿qué de todo lo que quiero ver puedo ver ahora?"), y los tres diferenciadores (historial real de IMDb, nunca sugiere repetidos, se adapta al servicio actualmente contratado). Confirmado leyendo el documento fuente.

### Fuera de alcance

- Cualquier cambio a la lógica interna de `components/layout/Sidebar.tsx` — reutilizado verbatim de RIK-12 con un valor distinto de prop `items`.
- Contenido legal/corporativo del footer — el PRD dice explícitamente "nada más — no hay contenido legal/corporativo definido todavía."
- Depurar los assets del starter `public/next.svg` / `public/vercel.svg`, ahora sin uso — inofensivos, no requerido.
- Color de acento de marca — el PRD Sección 1.4 lo marca "Pendiente de definir"; este ticket usa la paleta neutra derivada de `mist` existente y las variantes por defecto de `Button`/`Card` únicamente.
- Familia tipográfica — explícitamente excluida de todo este análisis de vacíos por el solicitante.

---

## Plan de implementación

**Objetivo:** Dar a Rikuna una página de aterrizaje `/` real y consciente de sesión — cerrando el segundo vacío del PRD en esta serie — construida enteramente sobre el Header/Sidebar de RIK-12 en vez de duplicar el chrome de navegación.

**En alcance:**
1. `lib/supabase/proxy.ts` — agregar `"/"` a `AUTH_ONLY_PATHS`.
2. `components/layout/Header.tsx` — extender la prop `user` a `CurrentUser | null`; la rama sin sesión renderiza botones "Iniciar sesión"/"Crear cuenta".
3. `constants/marketingNavigation.ts` — lista de ítems de navegación sin sesión.
4. `features/marketing/{Hero,HowItWorks,TrustSection,MarketingFooter}.tsx`.
5. `app/(marketing)/layout.tsx` — chequeo de sesión + redirect + composición de Header/Sidebar (sin sesión).
6. `app/(marketing)/page.tsx` — compone las cuatro secciones.
7. Eliminar `app/page.tsx`.

**Fuera de alcance:** Cambios internos al Sidebar, contenido legal del footer, limpieza de assets del starter sin uso, color de acento de marca, familia tipográfica — ver Fuera de alcance arriba.

**Riesgos clave / compatibilidad:**
- Eliminar `app/page.tsx` mientras se agrega `app/(marketing)/page.tsx` debe pasar atómicamente — tener ambos simultáneamente es una colisión de rutas de Next.js en `/`.
- Extender el tipo de la prop `user` de `Header` no debe romper su sitio de llamada existente en `(app)` (el `app/(app)/layout.tsx` de RIK-12 pasa un `CurrentUser` no-nulo) — el cambio es aditivo (ampliar el tipo, agregar una rama), no un renombrado que rompa algo.
- `constants/marketingNavigation.ts` debe satisfacer exactamente el mismo tipo `NavItem` que RIK-12 definió en `constants/navigation.ts`, o `Sidebar`/`SidebarNavItem` necesitarán cambios de tipos que este ticket no pretende hacer.

**Mapeo de criterios de aceptación:**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | Chequeo de sesión + redirect de `app/(marketing)/layout.tsx` |
| AC-2 | `Hero.tsx` — nombre, tagline, dos CTAs |
| AC-3 | `HowItWorks.tsx` — 4 pasos con íconos |
| AC-4 | `TrustSection.tsx` |
| AC-5 | `MarketingFooter.tsx` |
| AC-6 | Rama sin sesión de `Header.tsx` + `Sidebar` con `constants/marketingNavigation.ts` |
| AC-7 | Eliminación de `app/page.tsx` + creación de `app/(marketing)/page.tsx`, ruta única |

---

## Prompt para Claude Code

```xml
<task id="RIK-13" title="Inicio (Marketing home)" depends_on="RIK-12">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access),
    with components/ reserved for shared, cross-feature UI.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full. It is currently MODIFIED and UNCOMMITTED on the working tree and
      already documents the `(marketing)` route group as the target structure for `/`: "Route group
      (marketing): app/(marketing)/page.tsx -> /. Public entry point (previously missing). Redirects to
      /panel if a session already exists; otherwise renders the Header + Sidebar in their unauthenticated
      variant." Treat this as the authoritative target, not a draft.</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data.
      Route groups ((marketing)) do not affect the URL path — confirm this against
      node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md before
      restructuring app/page.tsx.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 2.0 ("Zona Marketing — / Inicio") — the
      full content spec: Hero copy structure, Cómo funciona's 4 steps, trust section framing, footer scope,
      suggested components. Section 1.6 for the guest-variant Header/Sidebar table (which buttons appear
      without a session, and the guest sidebar's four items: Inicio, Cómo funciona, Iniciar sesión, Crear
      cuenta).</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md Sections 1 ("Resumen Ejecutivo" — the Quechua
      name meaning and the core question framing), and 5 ("Propuesta de Valor y Tono de Marca" — the
      exact tagline "Tu watchlist de IMDb, cruzada con el streaming que pagas este mes." and the three
      differentiators). Use this document's actual language for the Hero/trust copy — do not invent
      marketing copy from scratch.</item>
    <item>app/page.tsx — the exact current file: unmodified create-next-app starter content. You are
      deleting this file; read it first only to confirm nothing in it needs to carry forward (it doesn't
      — no session logic, no real copy, references only public/next.svg and public/vercel.svg which no
      other file in the repo imports).</item>
    <item>components/layout/Header.tsx and components/layout/Sidebar.tsx (from RIK-12) — the components
      you are reusing and, for Header, extending. Read RIK-12's implementation exactly as it landed before
      changing anything.</item>
    <item>constants/navigation.ts (from RIK-12) — the NavItem type and APP_NAV_ITEMS shape you must mirror
      exactly in the new constants/marketingNavigation.ts.</item>
    <item>lib/supabase/server.ts — getCurrentUser() and the CurrentUser type, reused as-is for the session
      check.</item>
    <item>lib/supabase/proxy.ts — the current AUTH_ONLY_PATHS array (["/auth/login", "/auth/sign-up"]) you
      are extending to include "/".</item>
    <item>components.json — confirm the real shadcn config ("style": "base-lyra", "baseColor": "mist",
      "iconLibrary": "lucide") before adding any component; this ticket is not expected to need new
      primitives (Button and Card already exist) but confirm before assuming.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna's `/` route has never had real content — app/page.tsx is still the exact create-next-app
    starter page. This ticket builds the actual marketing landing page per
    specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 2.0, and depends on RIK-12 (App shell:
    Header + Sidebar navigation), which must land first — this ticket reuses and extends
    components/layout/Header.tsx and components/layout/Sidebar.tsx rather than building a second set of
    navigation chrome, per ARCHITECTURE.md's explicit statement that both components render in BOTH the
    (marketing) and (app) route groups.

    The page has four content sections, in order: a Hero (Rikuna's name, its Quechua meaning "lo que se
    debe ver", a one-line value proposition, and two buttons — "Crear cuenta" and "Iniciar sesión"); a
    "Cómo funciona" section with 3-4 numbered steps (import your IMDb history -> declare your active
    streaming service -> get your monthly list -> discover something new and well-rated); a short trust
    section noting the data starts from the user's real IMDb ratings, not a generic recommendation
    algorithm; and a minimal footer with only login/register links (no legal or corporate content exists
    yet for this product).

    If a visitor already has a session, they should never see this page — redirect them straight to
    /panel. getCurrentUser() (lib/supabase/server.ts) is the existing, already-implemented way to check
    this server-side.

    The exact tagline and differentiators come from
    specs/RIKUNA-PRD-documento-especificacion-rikuna.md: "Tu watchlist de IMDb, cruzada con el streaming
    que pagas este mes." is the stated main message (Section 5); the three differentiators are: starts
    from the user's real history (not a cold-start profile), knows what you've already watched via IMDb
    ratings so it never repeats a suggestion, and adapts to whichever service is currently paid for
    instead of assuming every platform is available.
  </context>

  <ground_truth_db_notes critical="true">
    <note>No database work is involved in this ticket — these are codebase ground-truth facts, not schema
      facts, but are just as load-bearing.</note>
    <note>Next.js route groups (parentheses in folder names, e.g. (marketing)) do NOT appear in the URL.
      Moving the page from app/page.tsx to app/(marketing)/page.tsx keeps the route at exactly "/" — this
      is a file relocation for layout-scoping purposes, not a URL change.</note>
    <note>app/page.tsx and app/(marketing)/page.tsx CANNOT coexist — Next.js will error on the duplicate
      route for "/". Delete app/page.tsx in the same change that adds app/(marketing)/page.tsx.</note>
    <note>lib/supabase/proxy.ts's AUTH_ONLY_PATHS currently only redirects authenticated users away from
      "/auth/login" and "/auth/sign-up". It does NOT currently include "/" — an authenticated visitor to
      "/" today would see whatever app/page.tsx renders with no redirect at the middleware layer. Add "/"
      to this array so the redirect happens at the middleware layer (fast path), matching the existing
      pattern for the two auth pages exactly.</note>
    <note>Even after the middleware change, app/(app)/layout.tsx's own comment documents why a
      Server-Component-level check is ALSO needed: "Server Functions bypass proxy matchers, so this Server
      Component check is the real backstop." Apply the same reasoning here: app/(marketing)/layout.tsx
      must ALSO call getCurrentUser() itself and redirect("/panel") if a user is present, not rely on the
      middleware alone.</note>
    <note>components/layout/Header.tsx (from RIK-12) currently types its prop as `user: CurrentUser`
      (non-null) because its only caller, app/(app)/layout.tsx, always has a confirmed session by the time
      it renders Header. This ticket must widen that prop type to `user: CurrentUser | null` and add a
      guest-rendering branch (two buttons: "Crear cuenta" linking to /auth/sign-up, "Iniciar sesión" linking
      to /auth/login, replacing the Avatar/DropdownMenu). Do NOT change the (app) call site — passing a
      guaranteed-non-null CurrentUser there continues to work unchanged against the widened type.</note>
    <note>constants/navigation.ts (from RIK-12) exports `export type NavItem = { label: string; href:
      string; icon: LucideIcon }`. constants/marketingNavigation.ts must use the exact same NavItem type
      (import it, do not redefine it) so Sidebar/SidebarNavItem require zero changes to accept the new
      list.</note>
    <note>components/ui/button.tsx and components/ui/card.tsx already exist (Button since project
      inception, Card added in RIK-9) — this ticket needs no new shadcn primitives. Confirm against the
      real components.json ("base-lyra" style) only if you find yourself needing something beyond
      Button/Card/the existing Lucide icon set.</note>
    <note>public/next.svg and public/vercel.svg are referenced ONLY by the app/page.tsx file being
      deleted (confirmed via repo-wide grep) — leaving them unused in public/ after this change is
      harmless and not part of this ticket's scope to clean up.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="Middleware">
      <item>In lib/supabase/proxy.ts, add "/" to the AUTH_ONLY_PATHS array so authenticated visitors are
        redirected to /panel at the middleware layer, matching the existing pattern for /auth/login and
        /auth/sign-up exactly (same redirect construction, same use of request.nextUrl.clone()).</item>
    </phase>

    <phase title="Header guest variant">
      <item>In components/layout/Header.tsx, widen the `user` prop's type from `CurrentUser` to
        `CurrentUser | null`. When user is null, render the guest-variant right side per PRD 1.6: two
        Buttons, "Crear cuenta" (variant matching the CTA style, linking to /auth/sign-up) and "Iniciar
        sesión" (secondary/outline style, linking to /auth/login) — replacing the
        Avatar/DropdownMenu/ThemeToggle/sign-out block entirely for this branch. Do not remove or alter the
        existing non-null branch used by app/(app)/layout.tsx.</item>
    </phase>

    <phase title="Constants">
      <item>Create constants/marketingNavigation.ts, importing the NavItem type from
        constants/navigation.ts, exporting `MARKETING_NAV_ITEMS: NavItem[]` with four items: "Inicio" (href
        "#inicio", an appropriate Lucide icon e.g. Home), "Cómo funciona" (href "#como-funciona", e.g.
        HelpCircle or ListChecks), "Iniciar sesión" (href "/auth/login", e.g. LogIn), "Crear cuenta" (href
        "/auth/sign-up", e.g. UserPlus).</item>
    </phase>

    <phase title="Marketing feature sections">
      <item>Create features/marketing/Hero.tsx: an id="inicio" section rendering "Rikuna" prominently, a
        short line explaining the Quechua meaning ("del quechua, 'lo que se debe ver'"), the one-line value
        proposition ("Tu watchlist de IMDb, cruzada con el streaming que pagas este mes." or a close
        paraphrase), and two Buttons ("Crear cuenta" -> /auth/sign-up, "Iniciar sesión" ->
        /auth/login).</item>
      <item>Create features/marketing/HowItWorks.tsx: an id="como-funciona" section with 3-4 numbered
        steps, each with a Lucide icon, short title, and one line of copy: (1) importa tu historial de IMDb,
        (2) indica tu servicio activo, (3) recibe tu lista del mes, (4) descubre algo nuevo. Use Card or
        simple stacked blocks per PRD's suggested-components note — either is acceptable, pick one and
        apply it consistently across all four steps.</item>
      <item>Create features/marketing/TrustSection.tsx: a short section (a few sentences, not a full
        paragraph wall) stating the data starts from the visitor's own real IMDb ratings rather than a
        generic algorithm — paraphrase specs/RIKUNA-PRD-documento-especificacion-rikuna.md Section 5's
        differentiators, do not copy them verbatim at length.</item>
      <item>Create features/marketing/MarketingFooter.tsx: a minimal footer with only a login link and a
        register link — no legal/corporate content, per the PRD's explicit "nada más" instruction.</item>
    </phase>

    <phase title="Route">
      <item>Create app/(marketing)/layout.tsx: an async Server Component that calls getCurrentUser(); if a
        user is present, redirect("/panel"); otherwise render Header (guest: user={null}) + Sidebar
        (items={MARKETING_NAV_ITEMS}) + {children}, following the same compositional shape RIK-12 used in
        app/(app)/layout.tsx (Header spanning the top, Sidebar alongside the content area).</item>
      <item>Create app/(marketing)/page.tsx composing, in order: Hero, HowItWorks, TrustSection,
        MarketingFooter.</item>
      <item>Delete app/page.tsx in the same change — Next.js cannot resolve "/" from two different
        page.tsx files simultaneously.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">An authenticated visitor requesting "/" is redirected to "/panel" without seeing
      any marketing content. Verify: log in, navigate directly to "/", confirm the final URL is
      "/panel".</criterion>
    <criterion id="AC-2">An unauthenticated visitor to "/" sees a Hero section containing the name
      "Rikuna", a mention of its Quechua meaning, a one-line value proposition, and exactly two CTA
      buttons ("Crear cuenta" and "Iniciar sesión") that navigate to /auth/sign-up and /auth/login
      respectively. Verify: log out, navigate to "/", inspect the rendered Hero and click each
      button.</criterion>
    <criterion id="AC-3">The page includes a "Cómo funciona" section with 3-4 steps, each showing an icon,
      a short title, and one line of copy, covering: importing IMDb history, declaring the active service,
      receiving the monthly list, and discovering new titles. Verify: visually confirm all four concepts
      appear, each with an icon.</criterion>
    <criterion id="AC-4">The page includes a short trust section mentioning that recommendations are based
      on the visitor's real IMDb history rather than a generic algorithm. Verify: visually confirm the
      section exists and its copy makes this claim.</criterion>
    <criterion id="AC-5">The page includes a minimal footer with a login link and a register link and no
      other content. Verify: inspect the footer, confirm only these two links are present.</criterion>
    <criterion id="AC-6">The unauthenticated "/" page renders the guest-variant Header (no avatar/user
      menu; "Crear cuenta"/"Iniciar sesión" buttons instead) and a Sidebar with exactly four items — Inicio,
      Cómo funciona, Iniciar sesión, Crear cuenta — reusing the same Header/Sidebar components RIK-12
      built for the authenticated zone. Verify: inspect the rendered Header/Sidebar as a logged-out
      visitor; confirm clicking "Cómo funciona" scrolls to the how-it-works section and "Iniciar
      sesión"/"Crear cuenta" navigate correctly.</criterion>
    <criterion id="AC-7">There is exactly one page.tsx resolving to "/" in the repository (app/page.tsx no
      longer exists; app/(marketing)/page.tsx does), and `npm run build` succeeds with no route-collision
      error. Verify: `ls app/page.tsx` returns not-found; `ls app/(marketing)/page.tsx` exists; build
      succeeds.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT keep app/page.tsx alongside app/(marketing)/page.tsx — delete the former in the same
      change.</item>
    <item>Do NOT change components/layout/Header.tsx's authenticated branch behavior or its call site in
      app/(app)/layout.tsx — only widen the prop type and add the guest branch.</item>
    <item>Do NOT redefine the NavItem type in constants/marketingNavigation.ts — import it from
      constants/navigation.ts.</item>
    <item>Do NOT add legal/corporate footer content — PRD explicitly scopes the footer to login/register
      links only.</item>
    <item>Do NOT invent marketing copy unrelated to specs/RIKUNA-PRD-documento-especificacion-rikuna.md
      Sections 1 and 5 — the tagline and differentiators must trace back to that document.</item>
    <item>Do NOT introduce a brand accent color — PRD Section 1.4 marks this "Pendiente de definir"; use
      existing Button/Card variants and the mist-derived neutral palette only.</item>
    <item>Do NOT touch font-family/typography configuration — explicitly out of scope for this ticket
      per the requester.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
  </constraints>

  <out_of_scope>
    <item>Any change to components/layout/Sidebar.tsx's internals — reused verbatim from RIK-12 with a
      new items value only.</item>
    <item>Legal/corporate footer content — none exists yet for this product per the PRD.</item>
    <item>Removing the now-unused public/next.svg / public/vercel.svg starter assets — harmless, not
      required.</item>
    <item>Brand accent color definition — PRD marks it explicitly undecided.</item>
    <item>Font family / typography — explicitly excluded from this whole gap-analysis pass by the
      requester.</item>
  </out_of_scope>

  <implementation_notes>
    <item>app/(marketing)/layout.tsx — `export default async function MarketingLayout({ children }:
      LayoutProps&lt;'/'&gt;) { const user = await getCurrentUser(); if (user) redirect('/panel'); return
      (...) }`.</item>
    <item>components/layout/Header.tsx — change signature to `export function Header({ user }: { user:
      CurrentUser | null })` and branch with `{user ? (...) : (...)}`.</item>
    <item>constants/marketingNavigation.ts — `import type { NavItem } from "@/constants/navigation"` then
      `export const MARKETING_NAV_ITEMS: NavItem[] = [...]`.</item>
    <item>Anchor scrolling for "Inicio"/"Cómo funciona" sidebar items works via plain `<a href="#inicio">`
      semantics already inherent to SidebarNavItem's Link usage on the same page — no extra scroll-behavior
      JS is required as long as the target sections carry matching `id` attributes.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created/modified/deleted and wired end-to-end.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether adding "/" to lib/supabase/proxy.ts's AUTH_ONLY_PATHS is acceptable, since it is a
      shared middleware file already correctly configured for the rest of the app. Default if unconfirmed:
      proceed with the addition, mirroring the exact existing pattern for /auth/login and
      /auth/sign-up.</item>
    <item>Exact icon choices for the guest sidebar's "Inicio" and "Cómo funciona" items. Default if
      unconfirmed: Home and HelpCircle respectively.</item>
    <item>Whether "Cómo funciona" ships with 3 or 4 steps (PRD says "3-4"). Default if unconfirmed: 4
      steps, matching the PRD's own example enumeration (importar -> indicar servicio -> recibir lista ->
      descubrir).</item>
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
        <item>Format: `- RIK-13: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-13_marketing_home.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to marketing_home, matching specs/backlog/RIK-13_marketing_home.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-13_marketing_home.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: middleware / components / constants / features / app routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
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
      <item>NON-TECHNICAL: no file paths, no column or type names, no framework or library names. Translate them into product language (say "the homepage" instead of naming the route group, "the navigation menu" instead of naming the component).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots: list 2-3 numbered items — e.g. "Homepage hero and how-it-works section, logged out", "Homepage footer and trust section", "Logged-in visit to the homepage showing the redirect to the panel". Prefix each with `[attach: short label]`.</item>
      <item>Do NOT embed images — attachments are added by the human.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is UI-focused: include "## Prerequisites" (dev server running, one account to log in with and one logged-out browser/session), then "## UI validation" with numbered steps covering: visiting "/" logged out and reviewing each of the four sections, clicking both Hero CTAs, clicking the guest sidebar's "Cómo funciona" anchor link and confirming it scrolls to the right section, clicking "Iniciar sesión"/"Crear cuenta" in the guest sidebar, and finally logging in and requesting "/" directly to confirm the redirect to "/panel".</item>
      <item>Then "## Expected outcome" (bullets tying back to AC-1 through AC-7).</item>
      <item>Use concrete app paths: /, /panel, /auth/login, /auth/sign-up.</item>
      <item>No database validation section — this ticket has no schema/data component.</item>
    </deliverable>
  </completion_report>
</task>
```

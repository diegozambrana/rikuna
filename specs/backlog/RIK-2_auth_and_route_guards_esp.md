# RIK-2 — Autenticación y estructura de rutas

> Documento de lectura en español. La fuente de verdad es `specs/backlog/RIK-2_auth_and_route_guards.md` (inglés) — ante cualquier discrepancia, ese archivo manda.

## Resumen del ticket

Rikuna necesita un flujo funcional de registro/login/logout/recuperación de contraseña sobre Supabase Auth, además de los tres route groups (`(auth)`, `(app)`, `(public)`) y el guard de sesión que hace privado `(app)` dejando `(public)` abierto — este es el ticket que convierte el scaffold vacío de Create Next App en una app a la que un usuario real puede entrar. Depende de RIK-1 (esquema de BD + RLS) solo porque necesita que existan `auth.users` y las tablas personales protegidas por RLS; no toca ninguna migración.

- Un usuario puede registrarse, iniciar sesión, cerrar sesión, y recuperar/actualizar su contraseña por correo.
- Cualquier ruta bajo `(app)` redirige a `/auth/login` cuando no hay sesión.
- Las rutas bajo `(public)` son accesibles sin sesión y nunca son tocadas por el guard de `(app)` (el grupo y su soporte en el guard deben existir ya, aunque RIK-11 construya las páginas públicas reales después).
- Un usuario ya autenticado que visita `/auth/login` o `/auth/sign-up` es redirigido a `/panel`.
- Credenciales inválidas muestran un error claro (nunca un fallo silencioso).
- No existen comentarios del equipo más allá del ticket pegado — la descripción y los criterios de aceptación de abajo son el alcance completo.
- **La investigación reveló una corrección a nivel de framework que cambia cómo debe construirse este ticket**: el proyecto corre Next.js 16, que dejó obsoleto y renombró la convención de archivo raíz `middleware.ts` a `proxy.ts` (función exportada `proxy`, no `middleware`). Tanto el texto del ticket como `ARCHITECTURE.md` todavía dicen `middleware.ts` — ese nombre no debe usarse. Ver la tabla de discrepancias abajo.

---

## Contexto

### Ticket original

**Descripción:** Implementar login, registro, recuperación y actualización de contraseña (`/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`) con Supabase Auth (`@supabase/ssr`), y establecer los tres route groups (`(auth)`, `(app)`, `(public)`) con el guard de sesión en `middleware.ts` / `lib/supabase/proxy.ts`, tal como describe `ARCHITECTURE.md`.

**Criterios de aceptación:**

- [ ] Un usuario puede registrarse, iniciar sesión, cerrar sesión, y recuperar/actualizar su contraseña por correo.
- [ ] Cualquier ruta bajo `(app)` redirige a `/auth/login` si no hay sesión.
- [ ] Las rutas bajo `(public)` (lista pública, ficha de título pública — implementadas en un ticket posterior, RIK-11, pero el route group y el middleware deben soportarlas desde ya) son accesibles sin sesión y no son interceptadas por el guard de `(app)`.
- [ ] Un usuario ya autenticado que visita `/auth/login` o `/auth/sign-up` es redirigido a `/panel`.
- [ ] Credenciales inválidas muestran un error claro en el formulario (no un fallo silencioso).

Este ticket depende de RIK-1 (esquema + RLS). Ninguna otra dependencia bloqueante.

### Comentarios del equipo

Ninguno. Este es el ticket pegado literalmente del tracker, con una nota aclaratoria del brief de la tarea: `ARCHITECTURE.md` ya documenta las responsabilidades de los módulos (`lib/supabase/server.ts`, `client.ts`, `admin.ts`, `proxy.ts`), la nota de que `admin.ts` NO debe conectarse a las acciones de auth de este ticket, que `app/layout.tsx` necesita agregar `ThemeProvider`/`Toaster` (primer ticket que toca el layout raíz), y que el layout propio de `(app)` hace el envoltorio `AuthCheck`/redirect/`UserProvider` — pero construir `/panel` en sí es tarea de RIK-7; una página placeholder mínima alcanza aquí para probar que el guard funciona. Todo esto se trata como parte del alcance real del ticket, no como un hilo de comentarios separado.

---

## Análisis del estado actual

### Discrepancias ticket vs. proyecto

| Ticket dice | Realidad en el proyecto | Impacto |
| --- | --- | --- |
| El guard de sesión va en `middleware.ts` (así lo dicen tanto el texto del ticket como `ARCHITECTURE.md` §Routing) | Next.js 16 (instalado: `next@16.3.0`) **dejó obsoleta la convención de archivo `middleware.ts` y la renombró a `proxy.ts`** en la raíz del proyecto, con la función exportada renombrada de `middleware` a `proxy` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, `middleware.md`). `AGENTS.md` advierte explícitamente revisar `node_modules/next/dist/docs/` antes de escribir código porque "APIs, conventions, and file structure may all differ from your training data." | Hay que crear `proxy.ts` en la raíz del repo (no `middleware.ts`), exportando `proxy(request)` (o export por defecto) más un `matcher` config. Esto es distinto de — y no debe confundirse con — `lib/supabase/proxy.ts`, un archivo diferente en otra ruta que solo exporta el helper `updateSession()` que el `proxy.ts` raíz invoca. |
| `ARCHITECTURE.md` lista `/titulo/[slug]` solo bajo la tabla de rutas de la zona App autenticada | `RIKUNA-PRD-vistas-y-estilo-rikuna.md` §2 ("Público") lista la **misma URL** `/titulo/[slug]` de nuevo como "variante de solo lectura sin acciones personales" — es decir, una sola ruta compartida, no dos, que decide según la sesión dentro de la página (`ARCHITECTURE.md` §Features lo confirma: la feature `title` está "shared between authenticated and public variants, with an `isPublicView` flag"). | El guard de `(app)` NO debe proteger todo lo que esté fuera de `(auth)`/`(public)` por defecto, o forzaría un redirect a login sobre `/titulo/[slug]` para visitantes anónimos, rompiendo el requisito de ficha pública (construida después en RIK-9). El guard necesita una lista explícita de prefijos protegidos en vez de una regla de denegar-todo-excepto-público. Ver Decisiones tomadas #2. |
| El ticket da a entender que `supabase/` ya tiene estructura para conectar `middleware`/`proxy.ts` | `supabase/` todavía no existe (confirmado: no hay directorio). Lo crea RIK-1, dependencia de este ticket, y el propio spec de backlog de RIK-1 anota que puede crear `supabase/config.toml` "si no está ya scaffolded." | Si este ticket corre antes de que RIK-1 aterrice, `supabase/config.toml` / `supabase/templates/` no existirán; la personalización del link de las plantillas de correo de auth (ver Decisiones tomadas #7) debe quedar como TODO en ese caso, no como requisito duro. |
| `ARCHITECTURE.md` dice que el layout de `(app)` "envuelve a los hijos en `UserProvider`" respaldado por `stores/UserStore.ts` (Zustand) | `package.json` no tiene la dependencia `zustand`, y el brief de la tarea limita explícitamente las nuevas dependencias de este ticket a `@supabase/ssr`, `@supabase/supabase-js`, `next-themes` y `sonner` — "this is the first ticket that needs" esas cuatro, lo que implica que `zustand` intencionalmente no forma parte de este ticket. | `UserProvider` se implementa con React Context en este ticket, no con Zustand. `stores/UserStore.ts` se pospone al ticket futuro que realmente necesite mutación reactiva del estado del usuario en cliente. Ver Decisiones tomadas #4. |
| `components.json` / `ARCHITECTURE.md` referencian el estilo "Lyra" de shadcn/ui | `components.json` en realidad tiene `"style": "base-lyra"` (variante Base UI — según `.agents/skills/migrate-radix-to-base/`, este proyecto ya migró fuera de Radix) y solo existe `components/ui/button.tsx` | Los formularios de auth necesitan los primitivos `Input`, `Label`, `Card`, `Alert` agregados vía CLI de `shadcn` (ya es dependencia, v4.16.2) usando el registro `base-lyra`, antes de construir las pantallas — no se asume que ya existan. |

### Estado actual en la base de datos

Este ticket no toca la base de datos directamente (no crea ninguna migración). Como contexto: `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` muestra cada tabla personal (`user_subscriptions`, `user_media_status`, `user_lists`, `imdb_import_batches`) con `user_id uuid not null references auth.users(id) on delete cascade` (líneas 195, 228, 270, 300) — `auth.users` es la tabla propia de Supabase Auth, manejada por Supabase independientemente de si las migraciones de RIK-1 ya aterrizaron. **No existe ninguna tabla `profiles`** (ni similar) en el documento de esquema — nada contra qué hacer join para un nombre para mostrar.

`supabase/migrations/` todavía no existe en este repo (dependencia de RIK-1). Si ya existe cuando corra este ticket, solo hay que revisar el archivo más reciente para reconfirmar los supuestos sobre `auth.users`/RLS de arriba — este ticket no agrega ninguna migración.

### Lógica actual (routing / auth)

Nada existe todavía: no hay `middleware.ts`/`proxy.ts`, no hay `lib/supabase/`, no hay `app/auth/*`, no hay route groups. `app/layout.tsx` sigue siendo el default de Create Next App más la configuración de fuentes del proyecto — metadata en inglés ("Create Next App"), sin `ThemeProvider`, sin `Toaster`:

```12:32:app/layout.tsx
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, robotoSlabHeading.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

`app/globals.css` ya tiene los tokens de diseño `base-lyra`/`mist` (variantes claro + `.dark`) conectados vía `@theme inline`, así que el CSS de modo oscuro ya está listo — solo falta conectar `ThemeProvider` (`next-themes`, atributo `class`, `defaultTheme="dark"`).

### Mapeo de campos solicitados

| Campo solicitado | Tipo | Equivalente existente | Acción |
| --- | --- | --- | --- |
| `correo` / `contraseña` (login, registro) | integrado en Supabase Auth | `auth.users.email` / `auth.users.encrypted_password`, manejado enteramente por Supabase Auth | Ya existe (reutilizar) — usar `supabase.auth.signInWithPassword` / `signUp` |
| `nombre` (campo del formulario de registro, según `RIKUNA-PRD-vistas-y-estilo-rikuna.md` §2.1) | texto | Ninguno — no hay tabla `profiles` en el esquema de RIK-1 | Debe crearse, pero **no** como columna de BD: se guarda como `user_metadata.full_name` de Supabase Auth vía `signUp({ options: { data: { full_name } } })` |
| Sesión usada por el guard de `(app)` | n/a | Ninguno todavía | Debe crearse — nuevo helper `getCurrentUser()` en `lib/supabase/server.ts` que envuelve `supabase.auth.getUser()` |
| FK `user_id` en tablas personales | uuid → `auth.users(id)` | Ya definido en el documento de esquema (asunto de RIK-1, no de este ticket) | Ya existe (reutilizar) — sin cambios aquí |

### Archivos impactados

**Config / dependencias**
- `package.json` (modificado) — agrega `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner`. No agregar `zustand`, `react-hook-form`, `@tanstack/react-table` (fuera de alcance, ver Decisiones tomadas #4/#5).
- `.env.example` (creado) — placeholders para `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. No se crea ni se hace commit de ningún archivo `.env*` real.

**`lib/supabase/`**
- `lib/supabase/server.ts` (creado) — `createClient()` vía `createServerClient` conectado a `await cookies()` (en esta versión de Next.js, `cookies()` es asíncrono); helper `getCurrentUser()`.
- `lib/supabase/client.ts` (creado) — `createClient()` vía `createBrowserClient`.
- `lib/supabase/admin.ts` (creado) — cliente con service-role, `import 'server-only'`, reservado para `ingestion/`. Se crea para que el límite del módulo exista, pero no se importa en ningún lado de este ticket.
- `lib/supabase/proxy.ts` (creado) — `updateSession(request)`: refresca la cookie de auth, aplica el chequeo de prefijos protegidos y el redirect de usuario autenticado visitando `/auth/*`.

**Proxy raíz (convención de Next.js 16)**
- `proxy.ts` (creado, raíz del repo — **no** `middleware.ts`) — importa `updateSession`, exporta `proxy(request)` + config de `matcher` excluyendo assets estáticos.

**Server Actions**
- `actions/auth/types.ts` (creado) — forma de `AuthActionState` para `useActionState`.
- `actions/auth/signIn.ts`, `signUp.ts`, `signOut.ts`, `forgotPassword.ts`, `updatePassword.ts` (creados).
- `actions/auth/index.ts` (creado) — barrel export, según la convención de `actions/` de `ARCHITECTURE.md`.

**Rutas**
- `app/(auth)/layout.tsx` (creado) — redirige a `/panel` si ya hay sesión; shell mínimo centrado.
- `app/(auth)/auth/login/page.tsx`, `sign-up/page.tsx`, `forgot-password/page.tsx`, `update-password/page.tsx` (creados).
- `app/(auth)/auth/confirm/route.ts` (creado) — verificación OTP por `token_hash` + `type` (confirmación de registro, links de recuperación).
- `app/(auth)/auth/callback/route.ts` (creado) — intercambio de `code` (PKCE), por paridad con la mención explícita de `ARCHITECTURE.md`, aunque todavía no hay ningún proveedor OAuth configurado.
- `app/(app)/layout.tsx` (creado) — `AuthCheck` (redirige a `/auth/login?next=...` si no hay sesión), carga `getCurrentUser()`, envuelve a los hijos en `UserProvider`.
- `app/(app)/panel/page.tsx` (creado) — placeholder mínimo ("Panel — próximamente", la construcción real es RIK-7) que prueba que el guard funciona.
- `app/(public)/layout.tsx` (creado) — shell mínimo (solo logo + enlaces a login/registro, según `ARCHITECTURE.md` §Shared UI).
- `app/(public)/l/[codigo]/page.tsx` (creado) — placeholder mínimo para que AC-3 sea verificable de punta a punta ya mismo; RIK-11 reemplaza su contenido.
- `app/layout.tsx` (modificado) — agrega `ThemeProvider` (`next-themes`, oscuro por defecto) y `Toaster` (`sonner`); actualiza `metadata` a copy en español/Rikuna.

**UI / estado compartido**
- `components/providers/UserProvider.tsx` (creado) — React Context (no Zustand — ver Decisiones tomadas #4).
- `hooks/useSession.ts` (creado) — lee el contexto de `UserProvider`.
- `components/ui/input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx` (creados vía CLI de `shadcn`, estilo `base-lyra`, según `components.json`).

**Configuración del proyecto Supabase**
- `supabase/config.toml` / `supabase/templates/*.html` (modificado si existe, si no TODO) — apunta los links de correo de recuperación/confirmación a `/auth/confirm`.

**Docs**
- `CHANGELOG.md` (modificado) — un bullet bajo `[Unreleased] / Added`.
- `specs/logs/<timestamp>_RIK-2_auth_and_route_guards.md` (creado) — bitácora de trabajo.

**Explícitamente no tocado:** ningún archivo llamado `middleware.ts` en ningún lado; ningún archivo `supabase/migrations/*`; ningún `stores/UserStore.ts`; ninguna adición a `types/index.ts` (nada aquí mapea a una entidad del documento de esquema).

### Decisiones tomadas

1. **El archivo proxy raíz sigue la convención de Next.js 16: `proxy.ts` en la raíz del repo, no `middleware.ts`**, exportando `proxy(request)`. Esto corrige tanto el texto del ticket como `ARCHITECTURE.md`, que son anteriores a este cambio de framework. Default recomendado, no confirmado por una persona.
2. **El guard de `(app)` en `lib/supabase/proxy.ts` usa una lista explícita de prefijos de ruta protegidos** (`/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`) en vez de "proteger todo excepto `(auth)`/`(public)`". Razón: `/titulo/[slug]` es de doble propósito (ver tabla de discrepancias) y nunca debe forzarse por el redirect de login — su propio manejo de sesión opcional llega con RIK-9. Default recomendado.
3. **El campo "nombre" del registro se guarda como `user_metadata.full_name` de Supabase Auth**, no como columna/tabla nueva de BD — no existe tabla `profiles` en el documento de esquema de RIK-1 y crear una está fuera de alcance para un ticket de auth/routing. Default recomendado.
4. **`UserProvider` usa React Context, no Zustand.** `zustand` no es una dependencia instalada, y el brief de la tarea limita las nuevas dependencias de este ticket a `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner` solamente. `stores/UserStore.ts` se pospone al primer ticket que realmente necesite mutación reactiva en cliente del estado del usuario (probablemente RIK-7 o después). Default recomendado.
5. **Los formularios de auth usan `<form>` nativo + Server Actions con `useActionState` de React 19**, no `react-hook-form`. `react-hook-form` está listado en `ARCHITECTURE.md` para formularios orientados a esquema/tabulares y todavía no está instalado; un formulario de auth de 2-4 campos no lo necesita, y traerlo aquí adelantaría una dependencia que este ticket no requiere de otro modo. Default recomendado.
6. **Se agrega una página placeholder bajo `(public)`** (`app/(public)/l/[codigo]/page.tsx`) solo para que AC-3 (pass-through, sin redirect) sea verificable de punta a punta en este ticket, siguiendo el mismo patrón ya autorizado para el placeholder de `(app)/panel`. RIK-11 reemplaza su contenido; este ticket no debe construir la lógica real de listas públicas. Default recomendado.
7. **`/auth/confirm/route.ts` (token_hash + type) es el flujo principal; `/auth/callback/route.ts` (intercambio de code) se construye por paridad con `ARCHITECTURE.md`**, aunque todavía no haya ningún proveedor OAuth configurado — barato de agregar, mantiene intacto el límite de módulo que documenta `ARCHITECTURE.md` para cuando se agregue OAuth o magic links. Default recomendado.
8. **Los links de las plantillas de correo de Supabase Auth se actualizan solo si `supabase/config.toml` ya existe** (es decir, si RIK-1 aterrizó primero); si no, quien implemente deja un comentario `TODO` en `auth/confirm/route.ts` en vez de scaffoldear config de proyecto de Supabase que no es claramente responsabilidad de este ticket. Default recomendado.
9. **No se crea ni se hace commit de ningún archivo `.env.local`/`.env`** — solo `.env.example` con valores placeholder, consistente con la regla de seguridad contra descargar/commitear secretos. No negociable, más una restricción dura que una "decisión".

### Fuera de alcance

- Construir de verdad `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, `/titulo/[slug]` — tickets posteriores (RIK-6 a RIK-10); este ticket solo necesita que el guard funcione y un placeholder que lo pruebe.
- `stores/UserStore.ts` (Zustand) y `hooks/useActiveSubscription` — pospuestos, ver Decisiones tomadas #4.
- Proveedores OAuth / login social — no solicitado, ningún proveedor configurado todavía en este proyecto.
- Shell autenticado completo `Header`/`Nav` (`components/layout/`) — tarea de RIK-7; el placeholder de `(app)/panel` no necesita más que un control de logout para probar AC-1.
- Diseño visual / redacción de las plantillas de correo — solo el destino del link importa para que este ticket funcione; el contenido cosmético de la plantilla no está en alcance.
- Rate limiting / CAPTCHA / protección anti-bots en los formularios de auth — no solicitado por el ticket ni el PRD.
- Una tabla `profiles` (o similar) en la base de datos — ver Decisiones tomadas #3.

---

## Plan de implementación

**Objetivo:** Conectar Supabase Auth de punta a punta (registro, login, logout, recuperar/actualizar contraseña) y hacer reales los tres route groups, para que `(app)` sea comprobablemente privado, `(public)` sea comprobablemente abierto, y todos los tickets posteriores tengan una sesión funcional sobre la cual construir.

**En alcance**
1. Agregar `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner` a `package.json`; crear `.env.example`.
2. Construir `lib/supabase/server.ts`, `client.ts`, `admin.ts` (factories de cliente) y `lib/supabase/proxy.ts` (`updateSession()` con la lista de prefijos protegidos).
3. Crear el `proxy.ts` raíz (convención de Next.js 16 — **no** `middleware.ts`) que invoca `updateSession()`.
4. Construir `actions/auth/` (signIn, signUp, signOut, forgotPassword, updatePassword) como Server Actions compatibles con `useActionState`.
5. Construir las pantallas de `app/(auth)/*` y los route handlers `auth/confirm` + `auth/callback`; `app/(auth)/layout.tsx` redirige a `/panel` a un visitante ya autenticado.
6. Construir `app/(app)/layout.tsx` (`AuthCheck` + `UserProvider`) y un `app/(app)/panel/page.tsx` placeholder mínimo.
7. Construir `app/(public)/layout.tsx` y una página placeholder (`/l/[codigo]`) para que el pass-through sea demostrable.
8. Actualizar el `app/layout.tsx` raíz con `ThemeProvider` (oscuro por defecto) y `Toaster`; corregir metadata a Rikuna/español.
9. Agregar primitivos shadcn `Input`/`Label`/`Card`/`Alert`; construir `UserProvider` (Context) y el hook `useSession`.

**Fuera de alcance:** pantallas reales de `/panel`/`/biblioteca`/etc., `UserStore` de Zustand, OAuth, shell de Header/Nav, diseño de plantillas de correo, CAPTCHA — ver Fuera de alcance arriba para el razonamiento.

**Riesgos clave / compatibilidad**
- Definir mal la lista de prefijos protegidos de `(app)` es el ítem de mayor riesgo: demasiado amplia bloquea silenciosamente la futura variante pública de `/titulo/[slug]`; demasiado angosta deja una ruta personal sin proteger. Las restricciones abajo nombran la lista exacta.
- `middleware.ts` vs `proxy.ts` es un error fácil para un agente entrenado con versiones de Next.js anteriores a la 16 — señalado explícitamente en restricciones y lectura obligatoria.
- `cookies()` debe usarse con `await` (Next.js 15+/16) dentro de `lib/supabase/server.ts`, o el cliente de Supabase en servidor obtiene silenciosamente un jar de cookies obsoleto/vacío.

**Mapeo de criterios de aceptación**

| AC | Satisfecho por |
| --- | --- |
| AC-1 | `actions/auth/*` + páginas `app/(auth)/auth/*` cubren registro, login, logout, olvidé/actualizar contraseña, todo respaldado por llamadas reales a Supabase Auth |
| AC-2 | El chequeo de prefijos protegidos en `lib/supabase/proxy.ts` redirige a `/auth/login?next=...` |
| AC-3 | El route group `(public)` + página placeholder son alcanzables sin sesión, `updateSession()` nunca aplica el chequeo de prefijos protegidos fuera de la lista |
| AC-4 | `app/(auth)/layout.tsx` chequea sesión y redirige a `/panel` |
| AC-5 | La rama de error de `useActionState` renderiza un `Alert` de shadcn con el mensaje de error de Supabase Auth |
| AC-6 (derivado) | El archivo raíz es `proxy.ts`, no `middleware.ts` — verificado por listado de archivos |
| AC-7 (derivado) | `/titulo` está ausente de `PROTECTED_PREFIXES` — verificado leyendo `lib/supabase/proxy.ts` |

---

## Prompt para Claude Code

```xml
<task id="RIK-2" title="Autenticación y estructura de rutas" depends_on="RIK-1">
  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 + TypeScript +
    Supabase project. You write English code, comments and identifiers; user-visible copy is Spanish.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full before writing anything. Sections "Routing (app/)" and "Supabase integration (lib/supabase/)" define this ticket's module boundaries exactly.</item>
    <item>AGENTS.md — this project's Next.js version may differ from your training data; it explicitly instructs reading node_modules/next/dist/docs/ before coding.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md — CRITICAL: Next.js 16 deprecated and renamed the root `middleware.ts` file convention to `proxy.ts`, and the exported function from `middleware` to `proxy`. Do not create `middleware.ts`.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md — `cookies()` from `next/headers` is async in this Next.js version; every call site in `lib/supabase/server.ts` must `await cookies()`.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the commit_message deliverable below.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 2 ("Mapa de vistas") for the Auth screens' exact content/fields and the Público-zone note that `/titulo/[slug]` is a read-only variant of the same URL, not a separate route.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 9 (RLS) and Section 10 (relationship map) to confirm every personal table's `user_id` references `auth.users(id)`; you are not creating or altering any of these tables.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — line mentioning "correo transaccional: confirmación de cuenta y recuperación de contraseña" as the product requirement behind the confirm/recovery email flow.</item>
    <item>app/layout.tsx, app/globals.css, lib/utils.ts, components.json, package.json, components/ui/button.tsx — read these real files before touching them; globals.css already has base-lyra/mist dark-mode tokens wired, only ThemeProvider plumbing is missing.</item>
    <item>supabase/migrations/ — if this directory exists (RIK-1 landed), skim the latest file only to reconfirm auth.users/RLS assumptions above; you are not adding a migration.</item>
    <item>CHANGELOG.md — read the [Unreleased] section format before appending.</item>
    <item>specs/logs/README.md — work log template and filename convention.</item>
  </mandatory_reading>

  <context>
    Rikuna is pre-launch, freshly scaffolded (Create Next App base), no production data. This ticket depends on
    RIK-1 only for `auth.users` (Supabase Auth's own managed table) and the RLS-protected personal tables existing —
    it adds no migration itself. Nothing under lib/, actions/, app/auth, or route groups exists yet; only
    app/layout.tsx, app/page.tsx, app/globals.css, lib/utils.ts, and components/ui/button.tsx exist so far.
    package.json currently has none of @supabase/ssr, @supabase/supabase-js, next-themes, or sonner — install
    exactly these four for this ticket. Do NOT install zustand, react-hook-form, or @tanstack/react-table; they
    belong to later tickets per ARCHITECTURE.md and are out of scope here.
  </context>

  <ground_truth_db_notes critical="true">
    <note>Next.js 16 renamed the root `middleware.ts` file convention to `proxy.ts`, and the exported function from `middleware` to `proxy`. Create `proxy.ts` at the repository root (same level as `app/`), exporting `proxy(request: NextRequest)` (or a default export) plus an exported `config` object with a `matcher`. Never create a file named `middleware.ts`.</note>
    <note>`lib/supabase/proxy.ts` is a DIFFERENT file at a different path — it only exports the `updateSession(request)` helper that the root `proxy.ts` imports and calls. Do not merge these two files or put Next.js's `proxy`/`config` exports inside `lib/supabase/proxy.ts`.</note>
    <note>`cookies()` from `next/headers` is async in this Next.js version. Every usage inside `lib/supabase/server.ts` (and anywhere else you read/write cookies server-side) must `await cookies()` before calling any method on the result.</note>
    <note>There is no `profiles` (or similarly named) table anywhere in the RIK-1 schema. Do not create one. The sign-up form's "nombre" field is stored via `supabase.auth.signUp({ options: { data: { full_name } } })` (Supabase Auth `user_metadata`), never as a new column or table.</note>
    <note>`/titulo/[slug]` appears in BOTH the authenticated App zone (ARCHITECTURE.md routing table) and the Público zone (RIKUNA-PRD-vistas-y-estilo-rikuna.md §2) as the SAME URL — it is one shared route with an `isPublicView` flag (built later in RIK-9), not two separate pages. The `(app)` guard's protected-prefix allowlist below must never include `/titulo` — this is intentional, not an omission.</note>
    <note>Every personal table (`user_subscriptions`, `user_media_status`, `user_lists`, `imdb_import_batches`) references `auth.users(id)` via `user_id`. `auth.users` is managed entirely by Supabase Auth — you never write to it directly; `supabase.auth.signUp`/`signInWithPassword`/`signOut`/`resetPasswordForEmail`/`updateUser` are the only entry points.</note>
    <note>`lib/supabase/admin.ts` (service-role client) must be created for the module boundary ARCHITECTURE.md documents, but must NOT be imported by anything in `actions/auth/` or any client bundle in this ticket — it is reserved exclusively for `ingestion/`.</note>
    <note>`components.json` has `"style": "base-lyra"` (Base UI, not Radix) and `"baseColor": "mist"`. Only `components/ui/button.tsx` exists under `components/ui/` today — add `input`, `label`, `card`, `alert` via the `shadcn` CLI (already a dependency) before building the auth screens; do not hand-write shadcn primitives from scratch.</note>
  </ground_truth_db_notes>

  <story>
    As a Rikuna user, I want to create an account, log in, log out, and recover a forgotten password by email, so
    that I can access my private planner data — and I want the parts of the app that require no account (shared
    lists, later) to stay reachable without being forced through a login wall.
  </story>

  <requirements>
    <phase title="1. Dependencies and env">
      <item>Add `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner` to `package.json` (dependencies) and install them.</item>
      <item>Create `.env.example` at the repo root with placeholder values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Do not create or commit a real `.env`/`.env.local` file.</item>
    </phase>

    <phase title="2. Supabase client layer (lib/supabase/)">
      <item>`lib/supabase/server.ts`: export `async function createClient()` using `createServerClient` from `@supabase/ssr`, bound to `await cookies()` from `next/headers` (getAll/setAll cookie methods per the `@supabase/ssr` Next.js App Router recipe). Export `async function getCurrentUser()` that calls `supabase.auth.getUser()` and returns `{ id, email, fullName } | null` (fullName from `user_metadata.full_name`).</item>
      <item>`lib/supabase/client.ts`: export `function createClient()` using `createBrowserClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.</item>
      <item>`lib/supabase/admin.ts`: export `function createAdminClient()` using `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`. Start the file with `import "server-only"`. Add a comment stating it is reserved for `ingestion/` and must never be imported from `actions/` or client code.</item>
      <item>`lib/supabase/proxy.ts`: export `async function updateSession(request: NextRequest): Promise<NextResponse>`. It must: (1) create a Supabase server client bound to the request/response cookies per the `@supabase/ssr` proxy recipe, (2) call `supabase.auth.getUser()` to refresh the session cookie, (3) define `const PROTECTED_PREFIXES = ["/panel", "/biblioteca", "/mis-listas", "/suscripciones", "/importar", "/perfil"]` and redirect to `/auth/login?next=<pathname>` when the request path starts with one of these and there is no user, (4) redirect an authenticated user visiting `/auth/login` or `/auth/sign-up` to `/panel`, (5) otherwise return the refreshed response unchanged. `/titulo` must NOT be in `PROTECTED_PREFIXES` (see ground_truth note).</item>
    </phase>

    <phase title="3. Root proxy.ts (Next.js 16 convention)">
      <item>Create `proxy.ts` at the repository root importing `updateSession` from `@/lib/supabase/proxy` and exporting `export function proxy(request: NextRequest) { return updateSession(request); }`.</item>
      <item>Export a `config` object with a `matcher` excluding `_next/static`, `_next/image`, and common static file extensions, e.g. `matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]`.</item>
    </phase>

    <phase title="4. Auth Server Actions (actions/auth/)">
      <item>`actions/auth/types.ts`: `export type AuthActionState = { status: "idle" | "error" | "success"; message?: string }`.</item>
      <item>`actions/auth/signIn.ts`: `signIn(prevState: AuthActionState, formData: FormData): Promise<AuthActionState>` — calls `supabase.auth.signInWithPassword`; on error return `{ status: "error", message }` (never throw, never silently no-op — this is what satisfies AC-5); on success `redirect("/panel")`.</item>
      <item>`actions/auth/signUp.ts`: same shape, calls `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: <origin>/auth/confirm } })`.</item>
      <item>`actions/auth/signOut.ts`: calls `supabase.auth.signOut()`, then `redirect("/auth/login")`.</item>
      <item>`actions/auth/forgotPassword.ts`: calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/confirm?type=recovery })`; always return a success-shaped state regardless of whether the email exists (standard practice — do not leak account existence).</item>
      <item>`actions/auth/updatePassword.ts`: calls `supabase.auth.updateUser({ password })` (requires the recovery session set by `auth/confirm`); on success `redirect("/panel")`.</item>
      <item>`actions/auth/index.ts`: barrel re-exporting all of the above, per ARCHITECTURE.md's `actions/` convention.</item>
    </phase>

    <phase title="5. (auth) route group">
      <item>`app/(auth)/layout.tsx`: server component; calls `getCurrentUser()`; if a user exists, `redirect("/panel")` (this satisfies the ticket's "already authenticated visiting /auth/login or /auth/sign-up" AC for every page in this group, since it wraps all of them). Minimal centered shell — logo/name only, no nav.</item>
      <item>`app/(auth)/auth/login/page.tsx`: client component form (email, password) using `useActionState(signIn, { status: "idle" })`; on `status === "error"` render a shadcn `Alert` (destructive variant) with `message`. Links to `/auth/sign-up` and `/auth/forgot-password`.</item>
      <item>`app/(auth)/auth/sign-up/page.tsx`: form (nombre, correo, contraseña, confirmación) using `useActionState(signUp, ...)`; inline validation that password === confirmation before submit; same error-alert pattern on failure.</item>
      <item>`app/(auth)/auth/forgot-password/page.tsx`: single-field (correo) form using `useActionState(forgotPassword, ...)`; on success show a confirmation message ("revisa tu correo"), not a redirect.</item>
      <item>`app/(auth)/auth/update-password/page.tsx`: two-field (nueva contraseña, confirmación) form using `useActionState(updatePassword, ...)`.</item>
      <item>`app/(auth)/auth/confirm/route.ts`: `GET` route handler reading `token_hash` and `type` from the URL, calling `supabase.auth.verifyOtp({ type, token_hash })`, then redirecting to `/auth/update-password` when `type === "recovery"` or to `/panel` otherwise; redirect to `/auth/login?error=...` on verification failure.</item>
      <item>`app/(auth)/auth/callback/route.ts`: `GET` route handler reading `code` from the URL, calling `supabase.auth.exchangeCodeForSession(code)`, redirecting to `/panel` on success or `/auth/login?error=...` on failure.</item>
    </phase>

    <phase title="6. (app) route group">
      <item>`app/(app)/layout.tsx`: server component; calls `getCurrentUser()`; if no user, `redirect("/auth/login?next=" + encodeURIComponent(currentPath))` (this is the AuthCheck ARCHITECTURE.md describes — belt-and-suspenders with the proxy-level check, since Server Functions bypass proxy matchers per the Next.js docs' own warning). Wrap children in `<UserProvider user={user}>`.</item>
      <item>`app/(app)/panel/page.tsx`: minimal placeholder — "Panel — próximamente" heading, current user's email, and a form calling `signOut` with a submit button labeled "Cerrar sesión". This is explicitly NOT the real panel (RIK-7); it exists only to prove the guard and logout work end-to-end.</item>
    </phase>

    <phase title="7. (public) route group">
      <item>`app/(public)/layout.tsx`: minimal shell per ARCHITECTURE.md §Shared UI — logo with link to `/auth/login`, no nav, no session check.</item>
      <item>`app/(public)/l/[codigo]/page.tsx`: placeholder page rendering the `codigo` param and "Lista pública — próximamente" — no data fetching, no auth check. Exists solely to make AC-3 verifiable now; RIK-11 replaces this file's contents.</item>
    </phase>

    <phase title="8. Root layout, theme, toasts, UI primitives">
      <item>Add `input`, `label`, `card`, `alert` to `components/ui/` via the `shadcn` CLI using this project's `base-lyra` registry/style (do not hand-author them).</item>
      <item>`components/providers/UserProvider.tsx`: React Context provider taking a `user` prop (the shape returned by `getCurrentUser()`), exposing it via a `useUserContext` hook.</item>
      <item>`hooks/useSession.ts`: thin wrapper calling `useUserContext()` from `UserProvider`, returning `{ user, isAuthenticated }`.</item>
      <item>Update `app/layout.tsx`: wrap `{children}` in `next-themes`' `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}` — dark default per ARCHITECTURE.md) and render `<Toaster />` from `sonner`. Update `metadata` to Spanish/Rikuna copy (title "Rikuna", a short Spanish description) instead of the Create Next App default.</item>
    </phase>

    <phase title="9. Supabase email templates (best-effort)">
      <item>If `supabase/config.toml` already exists (RIK-1 landed), update the recovery and confirmation email template link targets to point at `/auth/confirm` with the appropriate `type`/`token_hash` params, per the Supabase `@supabase/ssr` recipe. If it does not exist yet, add a `// TODO(RIK-2):` comment inside `app/(auth)/auth/confirm/route.ts` documenting that the Supabase project's email templates still need this link-target change (via Dashboard or `supabase/config.toml` once scaffolded) — do not scaffold `supabase/` yourself in this ticket.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">A user can sign up, log in, log out, and recover/update a password by email. Verify manually with `npm run dev`: sign up a test account, confirm via the emailed link (or local Supabase Inbucket if available), log out, log back in, trigger forgot-password, follow the recovery link, set a new password, log in with the new password.</criterion>
    <criterion id="AC-2">Any route under `(app)` redirects to `/auth/login` when there is no session. Verify: with no session cookie, request `/panel` — expect a redirect response to `/auth/login` (check both the proxy-level redirect and the `(app)/layout.tsx` fallback independently, e.g. by temporarily bypassing one).</criterion>
    <criterion id="AC-3">Routes under `(public)` are reachable without a session and are never redirected by the `(app)` guard. Verify: with no session cookie, request `/l/anything` — expect HTTP 200 rendering the placeholder, no redirect.</criterion>
    <criterion id="AC-4">An already-authenticated user visiting `/auth/login` or `/auth/sign-up` is redirected to `/panel`. Verify: with a valid session cookie, request `/auth/login` — expect a redirect response to `/panel`.</criterion>
    <criterion id="AC-5">Invalid credentials show a clear inline error, not a silent failure. Verify: submit `/auth/login` with a wrong password — expect the page to re-render with a visible `Alert` containing an error message, not a blank reload or console-only error.</criterion>
    <criterion id="AC-6">The session-refresh/guard file is `proxy.ts` at the repository root, not `middleware.ts`. Verify by file listing: `ls proxy.ts` succeeds, `ls middleware.ts` fails.</criterion>
    <criterion id="AC-7">`/titulo` is not present in the `(app)` guard's protected-prefix list, so a future unauthenticated request to `/titulo/[slug]` (built in RIK-9) will not be forced through the login redirect. Verify by reading `PROTECTED_PREFIXES` in `lib/supabase/proxy.ts`.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a file named `middleware.ts` anywhere — Next.js 16 uses `proxy.ts` at the project root with an exported `proxy` function.</item>
    <item>Do NOT import `lib/supabase/admin.ts` from `actions/auth/*`, any route handler in this ticket, or any client component — it is reserved exclusively for `ingestion/` per ARCHITECTURE.md.</item>
    <item>Do NOT create a `profiles` table, migration, or any `supabase/migrations/*` file — this ticket adds no migration. The sign-up "nombre" field is Supabase Auth `user_metadata` only.</item>
    <item>Do NOT add `zustand`, `react-hook-form`, or `@tanstack/react-table` to `package.json` — out of scope for this ticket.</item>
    <item>Do NOT include `/titulo` (or any prefix that would match it) in the `(app)` guard's protected-prefix list.</item>
    <item>Do NOT build real `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, or `/l/[codigo]` screens beyond the minimal placeholders specified in phases 6 and 7.</item>
    <item>Do NOT create or commit a real `.env`/`.env.local` file, or hardcode any real Supabase URL/key — `.env.example` with placeholders only.</item>
    <item>User-visible copy (form labels, buttons, error/success messages, placeholder text) is Spanish; code identifiers, comments, and commit messages are English, per ARCHITECTURE.md.</item>
    <item>Every new shadcn primitive under `components/ui/` must be added via the `shadcn` CLI using this project's configured `base-lyra` style/registry — do not hand-write Radix- or plain-HTML-based primitives that diverge from the existing `button.tsx`.</item>
  </constraints>

  <out_of_scope>
    <item>Building the real `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, `/titulo/[slug]` screens — later tickets (RIK-6 through RIK-10).</item>
    <item>`stores/UserStore.ts` (Zustand) and `hooks/useActiveSubscription` — deferred to whichever ticket first needs reactive client-side user-state mutation.</item>
    <item>OAuth / social login providers — not requested.</item>
    <item>Full `Header`/`Nav` authenticated shell (`components/layout/`) — RIK-7's job.</item>
    <item>Email template visual design — only the link target matters here.</item>
    <item>Rate limiting, CAPTCHA, or bot protection on auth forms.</item>
    <item>Any `supabase/migrations/*` file — this ticket is routing/auth-plumbing only.</item>
  </out_of_scope>

  <implementation_notes>
    <item>`lib/supabase/server.ts` and `lib/supabase/proxy.ts` both need the standard `@supabase/ssr` cookie-forwarding pattern (`getAll`/`setAll` on the cookie store) — implement it once and keep both call sites consistent with each other so refreshed cookies actually propagate.</item>
    <item>`getCurrentUser()` should call `supabase.auth.getUser()` (which revalidates against the Supabase Auth server), not `getSession()` (which only reads the local JWT) — this is the Supabase-recommended pattern for any server-side code making an authorization decision.</item>
    <item>Prefer `redirect()` from `next/navigation` inside Server Actions/Server Components for the "already authenticated" and "logged out" redirects; use `NextResponse.redirect()` only inside `proxy.ts`/route handlers.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases above, created or modified as specified.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test framework exists yet in this repo — do not introduce one for this ticket; note in the verification report where auth-flow tests should live once a framework is added (e.g. alongside `lib/supabase/` and `actions/auth/`).</item>
    <item>Persist documentation per the completion_report's persistence block below (CHANGELOG.md bullet + specs/logs/ file).</item>
  </deliverables>

  <clarify_before_coding>
    <item>Protected-prefix list for the `(app)` guard (`/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`) — default: proceed with this exact list, excluding `/titulo`, per Decisions made #2. If the team later adds an `(app)` route not in this list, it will silently be unprotected until the list is updated — flag this as a follow-up if noticed.</item>
    <item>Whether `UserProvider` should already be Zustand-backed — default: React Context only for this ticket, per Decisions made #4; revisit when a ticket needs reactive client-side user mutation.</item>
    <item>Whether to customize Supabase email templates now — default: only if `supabase/config.toml` already exists (RIK-1 landed first); otherwise leave a TODO, per Decisions made #8.</item>
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
        <item>Format: `- RIK-XXX: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_&lt;TICKET-ID&gt;_&lt;snake_case_slug&gt;.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion). Example: 202608091430_RIK-12_public_list_view.md.</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to `auth_and_route_guards`, matching specs/backlog/RIK-2_auth_and_route_guards.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-2_auth_and_route_guards.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: config / lib / actions / routes / components), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope — mention the email-template TODO here if left).</item>
      <item>Reference the ticket id in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses ✨).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section (this ticket has user-visible UI); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the login screen" instead of naming a component, "the account area" instead of naming a route group.</item>
      <item>Keep the core comment under 15 lines (excluding Screenshots).</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots — list what to capture as numbered items, each with: screen/area name, auth state, and what it should show. Suggest 3–4: (1) login screen with an invalid-credentials error showing, (2) sign-up screen, (3) the account area right after logging in, (4) an attempt to open the account area while logged out, showing the redirect to login. Prefix each with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is UI-focused with a routing/auth dimension — include "## Prerequisites" (dev server running, Supabase project env vars set, a way to receive the confirmation/recovery email or access Supabase's local Inbucket), then "## UI validation" with numbered steps covering: sign up, confirm email, log in, wrong-password error, visiting /panel while logged out (expect redirect to /auth/login), visiting /auth/login while logged in (expect redirect to /panel), visiting /l/anything while logged out (expect it to load, no redirect), forgot password → recovery email → update password → log in with new password, log out.</item>
      <item>Use concrete app paths: `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`, `/panel`, `/l/[codigo]`.</item>
      <item>Add a short "## Expected outcome" (1–3 bullets tying back to AC-1 through AC-5).</item>
    </deliverable>
  </completion_report>
</task>
```

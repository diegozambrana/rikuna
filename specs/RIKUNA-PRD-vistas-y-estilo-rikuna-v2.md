# Rikuna — Documento de Vistas y Sistema de Diseño

## 1. Sistema de diseño

**Librería:** shadcn/ui
**Style:** Lyra
**Base color:** Mist

### 1.1 Qué implica elegir Lyra

Lyra es uno de los siete estilos actuales de shadcn/ui (junto a Vega, Nova, Maia, Mira, Luma y Sera). Se caracteriza por:

- **Radio de borde en cero** — todo es recto, sin esquinas redondeadas. Nada de tarjetas "suaves" ni botones tipo píldora.
- **Estructura marcada y precisa** — combina bien con fuentes monoespaciadas para acentos (números, códigos, badges de estado).
- Pensado originalmente para **herramientas técnicas e interfaces orientadas a datos**.

Encaja bien con Rikuna: es una herramienta utilitaria de decisión ("qué ver ahora"), no una red social que busque sentirse suave o lúdica. La densidad de información (ratings, votos, año, disponibilidad) se lee mejor en un estilo estructurado que en uno redondeado.

### 1.2 Qué implica el base color Mist

`Mist` es uno de los colores base neutros de shadcn/ui (junto a Neutral, Stone, Zinc, Mauve, Olive y Taupe) — define la escala de grises de fondo, bordes y texto secundario sobre la que se apoya todo lo demás. Es un neutro de tendencia fría (grisáceo-azulado), más "frío" que Stone o Taupe. Para Rikuna funciona bien porque:

- Sostiene bien un **modo oscuro por defecto** (ya definido como estándar en el proyecto base), que es donde más tiempo se va a mirar la app (posters, calificaciones) sin que el fondo compita visualmente con las imágenes.
- Es neutro, no le "presta" personalidad a la marca — el color de marca/acento se define aparte (ver 1.4) y Mist solo resuelve los grises de estructura (fondos, bordes, texto secundario).

> Nota importante: este documento no inventa valores exactos de color (oklch/hex) para Lyra + Mist, porque esos valores los genera la propia herramienta oficial de shadcn y podrían no coincidir si se escriben a mano. El paso de construcción es correr `npx shadcn init` (o el generador visual en ui.shadcn.com) seleccionando `style: lyra` y `baseColor: mist`, y pegar el resultado en `app/globals.css` — así se documenta la intención, y el desarrollador obtiene los tokens reales al momento de construir.

### 1.3 Configuración base (`components.json`)

```json
{
  "style": "lyra",
  "rsc": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "mist",
    "cssVariables": true
  }
}
```

### 1.4 Decisiones complementarias

| Aspecto | Definición | Motivo |
|---|---|---|
| Modo por defecto | Oscuro | Consistente con el resto de la plataforma; mejor lectura de posters |
| Íconos | Lucide | Ya es el estándar del proyecto base |
| Tipografía | Sans-serif para toda la interfaz; monoespaciada solo en acentos puntuales (ej. calificación IMDb, contador de votos, año) | Aprovecha la afinidad de Lyra con fuentes mono sin volver ilegible el texto largo (sinopsis, nombres) |
| Color de acento / marca | Pendiente de definir (Sección 13 del documento de producto sigue abierta en este punto) | Mist resuelve los grises, no el color de marca |

### 1.5 Componentes shadcn por función

| Necesidad de la interfaz | Componente shadcn sugerido |
|---|---|
| Tarjeta de título en cuadrícula | `Card` + `AspectRatio` (para el poster) + `Badge` (rating, estado) |
| Listado de títulos con muchas columnas (biblioteca) | `Table` con `DataTable` (TanStack Table, ya usado en el proyecto base) |
| Filtros (género, tipo, disponibilidad) | `Select`, `Checkbox` dentro de un `Popover` o `Sheet` lateral |
| Búsqueda | `Command` (paleta de búsqueda) o `Input` con ícono |
| Formularios (login, registro, suscripción) | `Form` + `Input` + `Button`, validación con schema |
| Selector de plataforma/país | `Select` o `Combobox` |
| Confirmaciones (marcar visto, eliminar lista) | `AlertDialog` |
| Selector de lista al agregar un título | `Dialog` o `Popover` con lista de checkboxes |
| Subida de CSV | `Card` con dropzone + `Progress` durante el procesamiento |
| Resumen de importación | `Alert` (éxito/advertencia) + `Table` de detalle |
| Estados vacíos (sin resultados, biblioteca vacía) | `Empty state` compuesto manualmente con ícono + texto + `Button` de acción |
| Carga de imágenes (posters) | `Skeleton` mientras cargan |
| Pestañas (Vistas / Quiero ver / Todas) | `Tabs` |
| Navegación principal (Header) | `Avatar` + `DropdownMenu` (menú de usuario), `Button` (CTA sin sesión) — detalle completo en 1.6 |
| Navegación lateral (Sidebar) | Composición de `nav` + items estilizados, `Tooltip` en modo colapsado, `Sheet` para la versión mobile — detalle completo en 1.6 |
| Copiar enlace de lista pública | `Button` + `Tooltip` de confirmación ("Copiado") |

### 1.6 Layouts compartidos (Header + Sidebar)

Hasta ahora el documento definía las páginas pero no el andamiaje que las envuelve. Rikuna usa **tres layouts distintos**, no uno solo:

| Layout | Dónde se usa | Header | Sidebar |
|---|---|---|---|
| **Marketing** | `/` (Inicio) | Sí — variante sin sesión | Sí — variante sin sesión |
| **App** | Todas las páginas de la Zona App (2.2) | Sí — variante con sesión | Sí — variante con sesión |
| **Compartido (mínimo)** | `/l/[código]`, `/titulo/[slug]` público | Barra mínima: solo logo + botón "Iniciar sesión" | No |
| **Auth** | `/auth/*` | No | No |

> **Supuesto de diseño:** dejo las páginas de lista/título compartidas (`/l/[código]`) sin sidebar a propósito — son para que alguien externo abra un enlace puntual, no para que navegue el resto del sitio. Si prefieres que también tengan sidebar completo, es un cambio de una sola línea en esta tabla.

#### Header — contenido y comportamiento

| Elemento | Sin sesión (Marketing / Compartido) | Con sesión (App) |
|---|---|---|
| Izquierda | Logo "Rikuna", enlaza a `/` | Logo "Rikuna", enlaza a `/panel` |
| Derecha | Botones "Iniciar sesión" y "Crear cuenta" | `Avatar` con menú desplegable (ver abajo) |
| Mobile | — | Ícono de menú (`≡`) que abre el `Sidebar` como `Sheet` lateral |

**Menú del avatar (`DropdownMenu` anclado al `Avatar`):**
- Encabezado no interactivo: nombre y correo del usuario.
- Separador.
- "Perfil" → `/perfil`.
- "Cambiar tema" (claro/oscuro) — toggle inline o submenú.
- Separador.
- "Cerrar sesión" — estilo destructivo, ejecuta la acción de logout y redirige a `/`.

**Componentes:** `Avatar`, `DropdownMenu`, `DropdownMenuItem`, `Separator`, `Button` (para los dos botones de "sin sesión"), `Sheet` (menú mobile).

#### Sidebar — contenido y comportamiento

El sidebar es **siempre visible en desktop** (colapsable) y se convierte en `Sheet` lateral en mobile, abierto desde el ícono de menú del Header.

**Variante con sesión (Zona App):**

| Ítem | Ruta | Ícono sugerido |
|---|---|---|
| Qué ver este mes | `/panel` | `Home` / `LayoutDashboard` |
| Recomendaciones | `/recomendaciones` | `Sparkles` |
| Mi biblioteca | `/biblioteca` | `Library` |
| Mis listas | `/mis-listas` | `ListVideo` |
| Mis suscripciones | `/suscripciones` | `Tv` |
| Importar desde IMDb | `/importar` | `Upload` |

El ítem correspondiente a la ruta activa se resalta. "Perfil" y "Cerrar sesión" **no** van en el sidebar — ya viven en el menú del avatar, para no duplicar la navegación.

**Variante sin sesión (solo en `/`, layout Marketing):**

| Ítem | Comportamiento |
|---|---|
| Inicio | Ancla al tope de la propia página |
| Cómo funciona | Ancla a la sección correspondiente de `/` |
| Iniciar sesión | → `/auth/login` |
| Crear cuenta | → `/auth/sign-up` |

**Componentes:** `Sidebar` propio (o composición de `nav` + `Button`/`Link` estilizados como items), `Tooltip` en modo colapsado (solo ícono), `Sheet` para la versión mobile.

---

## 2. Mapa de vistas

Organizado en cuatro zonas según quién puede entrar: **Marketing** (sin sesión, página de inicio), **Auth** (sin sesión, flujo de acceso), **App** (requiere sesión), **Pública** (sin sesión, solo lectura de contenido compartido). Esta separación debe reflejarse en la estructura de rutas para que el middleware de autenticación no bloquee por error las zonas Marketing y Pública.

### 2.0 Zona Marketing

#### `/` — Inicio
- **Propósito:** página de entrada para cualquiera que llegue sin sesión (hoy no existía — este es el vacío que se cierra). Si el visitante ya tiene sesión iniciada, redirige directo a `/panel` en vez de mostrar esta página.
- **Contenido:**
  - **Hero:** nombre "Rikuna" + significado ("lo que se debe ver", quechua), propuesta de valor en una línea, dos botones ("Crear cuenta", "Iniciar sesión").
  - **Cómo funciona (3-4 pasos):** importa tu historial de IMDb → indica tu servicio activo → recibe tu lista del mes → descubre algo nuevo bien calificado.
  - **Sección de confianza:** breve mención de que los datos parten de calificaciones reales del usuario en IMDb, no de un algoritmo genérico.
  - Footer simple (enlace a login/registro, nada más — no hay contenido legal/corporativo definido todavía).
- **Componentes:** secciones apiladas con `Card` o bloques simples, `Button` para los CTA, íconos `Lucide` por paso.
- **Layout:** Marketing (Header + Sidebar variante sin sesión, según 1.6).

---

### 2.1 Zona Auth

#### `/auth/login` — Inicio de sesión
- **Contenido:** logo/nombre "Rikuna", formulario con correo y contraseña, enlace "¿Olvidaste tu contraseña?", enlace a registro.
- **Componentes:** `Card` centrada, `Form` + `Input` + `Button` ("Iniciar sesión").
- **Estados:** error de credenciales inválidas (`Alert` destructivo debajo del formulario).

#### `/auth/sign-up` — Registro
- **Contenido:** nombre, correo, contraseña, confirmación de contraseña, enlace a login.
- **Componentes:** igual estructura que login.
- **Estados:** validaciones en línea por campo; confirmación de cuenta creada.

#### `/auth/forgot-password` y `/auth/update-password`
- **Contenido:** el primero pide el correo; el segundo pide nueva contraseña + confirmación (se llega desde el enlace del correo).
- **Componentes:** `Form` simple de un solo campo.

---

### 2.2 Zona App (requiere sesión)

> Todas las páginas de esta zona usan el layout **App** (Header con avatar + Sidebar con sesión, ver 1.6).

#### `/panel` — Panel principal ("Qué ver este mes")
- **Propósito:** vista de aterrizaje tras iniciar sesión (ya no es `/` — esa ruta ahora es la página de Inicio de la Zona Marketing).
- **Contenido:**
  - Encabezado: servicio de streaming activo + país (ej. "Apple TV+ · Bolivia"), con acceso rápido para cambiarlo.
  - Contador: "23 títulos de tu lista disponibles ahora".
  - Cuadrícula de tarjetas: poster, título, año, `Badge` con calificación IMDb.
  - Estado vacío si no hay suscripción activa declarada: mensaje + botón "Configurar mi suscripción".
- **Componentes:** `Card` (encabezado de servicio activo), grilla de `Card` para títulos, `Badge`, `Skeleton` mientras carga.
- **Acciones:** click en tarjeta → Ficha de título. Botón de servicio activo → Mis suscripciones. Marcar visto directo desde la tarjeta (ícono de check).

#### `/recomendaciones` — Recomendaciones
- **Propósito:** descubrimiento.
- **Contenido:** dos secciones con `Tabs` o simplemente dos bloques apilados con títulos claros:
  1. "De tu lista de seguimiento, disponibles ahora" (subset del panel principal, o enlace a él).
  2. "Descubre algo nuevo" — títulos bien calificados, disponibles, fuera de tu watchlist. Filtro de género arriba (`Select`).
- **Componentes:** grilla de `Card`, `Select` de género, `Button` "No me interesa" (ícono, discreto) por tarjeta.
- **Acciones:** agregar a watchlist, descartar (`dismissed`), abrir ficha.

#### `/biblioteca` — Mi biblioteca
- **Propósito:** explorar y gestionar todo el historial personal.
- **Contenido:** `Tabs` — "Vistas" / "Quiero ver" / "Todas". Barra de filtros (tipo, género, año, rango de calificación, disponibilidad en servicio activo) y buscador por título. Tabla o grilla con el resultado.
- **Componentes:** `Tabs`, `Input` de búsqueda, `Select`/`Popover` de filtros, `DataTable` o grilla de `Card` (según se priorice densidad o imagen — para una biblioteca grande, `DataTable` es más eficiente).
- **Estados:** biblioteca vacía → mensaje invitando a importar desde IMDb.

#### `/titulo/[slug]` — Ficha de título (autenticado)
- **Contenido:**
  - Poster grande + información base (título, año, sinopsis, géneros).
  - `Badge` con calificación IMDb y cantidad de votos.
  - Elenco principal (avatares/nombres, scroll horizontal).
  - Tu calificación personal, si existe.
  - Sección "Dónde ver": lista de plataformas disponibles con su enlace; la que coincide con tu suscripción activa se destaca visualmente (ej. `Badge` "Tu servicio").
- **Componentes:** layout de dos columnas (poster + info), `Badge`, `Avatar` para elenco, `Button` de acciones (marcar visto, agregar/quitar watchlist, agregar a lista → `Dialog`).
- **Estados:** título "stub" (creado desde CSV, sin poster/sinopsis) → mostrar poster placeholder y aviso discreto "Información limitada, se completará pronto".

#### `/mis-listas` — Mis listas
- **Contenido:** listado de listas propias, cada una con nombre, cantidad de títulos, `Badge` de visibilidad (Pública/Privada). Botón "Nueva lista".
- **Componentes:** grilla o lista de `Card`, `Dialog` para crear/editar (nombre, descripción, switch público/privado).
- **Acciones:** entrar a una lista, crear nueva, cambiar visibilidad, copiar enlace si es pública.

#### `/mis-listas/[slug]` — Detalle de lista (vista de dueño)
- **Contenido:** nombre, descripción, switch de visibilidad, botón "Copiar enlace" (solo si es pública), grilla de títulos incluidos, reordenables.
- **Componentes:** `Switch` (visibilidad), `Button` + `Tooltip` (copiar enlace), grilla de `Card` con opción de arrastrar para reordenar.

#### `/suscripciones` — Mis suscripciones
- **Contenido:** suscripción activa actual con fecha de inicio; historial de suscripciones anteriores en una tabla simple; formulario para activar una nueva (selector de plataforma + país).
- **Componentes:** `Card` destacada para la activa, `Table` para el historial, `Select`/`Combobox` + `Button` para activar una nueva.

#### `/importar` — Importar desde IMDb
- **Contenido:** instrucciones breves ("Cómo exportar tu CSV desde IMDb", con pasos numerados), zona de carga de archivo, selector de tipo (Calificaciones / Lista de seguimiento), historial de importaciones previas con resumen (fecha, tipo, resultado).
- **Componentes:** `Card` con dropzone, `RadioGroup` o `Tabs` para el tipo de archivo, `Progress` durante el procesamiento, `Table` para el historial.
- **Acciones:** subir → procesar → redirige o expande el resumen.

#### `/importar/[batchId]` — Detalle de importación
- **Contenido:** tabla fila por fila del CSV procesado: título, imdb_id, resultado (reconocido / creado / omitido).
- **Componentes:** `DataTable` con `Badge` de color por resultado.

#### `/perfil` — Perfil / cuenta
- **Contenido:** datos de la cuenta (nombre, correo), preferencias (tema claro/oscuro si se permite cambiar), cerrar sesión.
- **Componentes:** `Form` simple, `Switch` para tema, `Button` destructivo para cerrar sesión.

---

### 2.3 Zona Pública (sin sesión)

> Estas páginas usan el layout **Compartido (mínimo)**: solo una barra superior con el logo y un botón de "Iniciar sesión" — sin sidebar, sin menú de avatar. Ver el supuesto de diseño en 1.6.

#### `/l/[código]` — Lista pública
- **Propósito:** que cualquiera con el enlace vea una lista pública sin necesidad de cuenta.
- **Contenido:** nombre y descripción de la lista, grilla de títulos (poster, título, año, calificación). **No** muestra nada del resto de la cuenta del dueño.
- **Componentes:** misma grilla de `Card` que el resto de la app, sin ninguna acción personal (no hay botón de "marcar visto", no hay menú de cuenta).
- **Acciones:** click en un título → Ficha de título pública. Llamado a la acción discreto para crear cuenta propia ("Crea tu propia lista en Rikuna").

#### `/titulo/[slug]` (variante pública)
- **Contenido:** misma ficha de título, pero sin las acciones que requieren sesión (marcar visto, agregar a lista). Si la persona no tiene sesión, esos botones llevan a login en vez de ejecutar la acción.

---

## 3. Notas para la herramienta de generación de UI

- Todas las vistas de la Zona App comparten el mismo layout base: barra lateral o superior de navegación (Panel, Recomendaciones, Biblioteca, Mis listas, Suscripciones, Importar) + menú de cuenta.
- La Zona Pública usa un layout mínimo, sin esa navegación — solo el logo de Rikuna con enlace a login/registro.
- El estilo Lyra implica **radio de borde 0** en todos los componentes generados (tarjetas, botones, inputs) — si la herramienta de generación de UI ofrece un valor de `border-radius` por defecto, debe forzarse a `0`.
- Todas las tarjetas de título deben reservar el espacio del poster con `AspectRatio` antes de que cargue la imagen, para evitar saltos de layout.

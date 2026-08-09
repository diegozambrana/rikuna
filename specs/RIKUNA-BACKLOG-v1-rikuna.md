# Rikuna — Backlog v1 (MVP)

> Deriva de `RIKUNA-PRD-documento-especificacion-rikuna.md` (Sección 12, Fase 1), `RIKUNA-PRD-schema-basedatos-rikuna.md` y `RIKUNA-PRD-vistas-y-estilo-rikuna.md`. Cubre todo lo imprescindible para la primera versión (uso propio, un solo usuario, pero con aislamiento multiusuario desde el diseño). No incluye Fase 2 ni Fase 3 — ver "Fuera de alcance" al final.
>
> Convención de IDs: `RIK-XXX`, consistente con `CHANGELOG.md` y `specs/logs/`. El orden de las tareas es también el orden de dependencia recomendado.

---

## RIK-1 — Esquema de base de datos y RLS

**Descripción:** Crear las migraciones de Supabase (`supabase/migrations/`) para todas las tablas del MVP: `media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`, `user_subscriptions`, `user_media_status`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows`. Incluye índices, constraints, triggers de `updated_at` y las políticas de RLS descritas en la Sección 9 del esquema (lectura pública de catálogo, aislamiento por dueño en datos personales, caso mixto público/privado en `user_lists`/`list_items`, incluyendo el `grant select ... to anon`).

**Criterios de aceptación:**
- [ ] Todas las tablas del esquema v3 existen con los tipos, constraints e índices definidos en `RIKUNA-PRD-schema-basedatos-rikuna.md`.
- [ ] RLS está habilitado en todas las tablas con datos de usuario; un usuario autenticado no puede leer ni escribir filas de `user_subscriptions`, `user_media_status`, `imdb_import_batches`/`rows` de otro usuario (verificado con dos cuentas de prueba).
- [ ] `user_lists`/`list_items` son legibles sin sesión (`anon`) solo cuando `is_public = true`; una lista privada devuelve vacío para `anon` y para otro usuario autenticado.
- [ ] `media_items`, `platforms`, `media_availability`, `catalog_snapshots`, `genres`, `people` son de lectura pública y de escritura solo para el rol de servicio.

---

## RIK-2 — Autenticación y estructura de rutas

**Descripción:** Implementar login, registro, recuperación y actualización de contraseña (`/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`) con Supabase Auth (`@supabase/ssr`), y establecer los tres route groups (`(auth)`, `(app)`, `(public)`) con el guard de sesión en `middleware.ts` / `lib/supabase/proxy.ts`, tal como describe `ARCHITECTURE.md`.

**Criterios de aceptación:**
- [ ] Un usuario puede registrarse, iniciar sesión, cerrar sesión, y recuperar/actualizar su contraseña por correo.
- [ ] Cualquier ruta bajo `(app)` redirige a `/auth/login` si no hay sesión.
- [ ] Las rutas bajo `(public)` (ver RIK-11) son accesibles sin sesión y **no** son interceptadas por el guard de `(app)`.
- [ ] Un usuario ya autenticado que visita `/auth/login` o `/auth/sign-up` es redirigido a `/panel`.
- [ ] Credenciales inválidas muestran un error claro en el formulario (no un fallo silencioso).

---

## RIK-3 — Ingesta del catálogo de disponibilidad

**Descripción:** Rutina en `ingestion/` (server-only, cliente admin de Supabase) que procesa los archivos por plataforma/país del proceso externo: crea un `catalog_snapshots`, hace upsert de cada título en `media_items` (creando stub si no existe) y en `media_availability` (`is_available = true`, `last_snapshot_id`), y al final marca `is_available = false` en todo lo que quedó fuera del snapshot recién procesado, según la lógica de la Sección 3.3 del esquema.

**Criterios de aceptación:**
- [ ] Cargar un archivo de ejemplo de una plataforma/país crea el `catalog_snapshots` correspondiente y puebla `media_availability` con `last_seen_at`/`last_snapshot_id` correctos.
- [ ] Un título que existía en el snapshot anterior pero no en el nuevo queda con `is_available = false` tras la carga, sin borrarse la fila.
- [ ] Cargar el mismo archivo dos veces es idempotente: no se duplican filas de `media_availability` (respeta el `unique (media_id, platform_id, country, offer_type)`).
- [ ] La rutina puede correrse de forma repetible (script o comando) sin intervención manual en base de datos.

---

## RIK-4 — Importación desde IMDb (calificaciones y watchlist)

**Descripción:** Vista `/importar` con carga de CSV, selector de tipo (Calificaciones / Lista de seguimiento) y procesamiento según la Sección 7.3 del esquema: crea `media_items` como stub (`is_stub = true`) si el `imdb_id` no existe, hace upsert en `user_media_status` (`watched`/`want_to_watch` según el tipo), respeta filas con `manually_edited = true`, y registra cada fila en `imdb_import_batches`/`imdb_import_rows` con su resultado (`matched`/`created`/`skipped`).

**Criterios de aceptación:**
- [ ] Subir el CSV de *Your Ratings* marca cada título como `watched = true` con `personal_rating` y `watched_at`, y crea como stub los que no existían en el catálogo.
- [ ] Subir el CSV de *Watchlist* marca `want_to_watch = true` sin tocar `watched` de títulos ya vistos.
- [ ] Al terminar el procesamiento se muestra un resumen (total, reconocidos, creados, omitidos) sin necesidad de recargar la página.
- [ ] Una fila cuyo `user_media_status.manually_edited = true` no es sobrescrita por la reimportación (salvo completar una calificación vacía).
- [ ] Un CSV con filas inválidas (columnas faltantes, `Const` vacío) marca esas filas como `skipped` sin abortar el resto del archivo.

---

## RIK-5 — Detalle de importación

**Descripción:** Vista `/importar/[batchId]` e historial de importaciones previas en `/importar`, mostrando fila por fila el resultado de cada lote (título, `imdb_id`, resultado) para dar transparencia total sobre qué pasó con cada título del CSV.

**Criterios de aceptación:**
- [ ] `/importar` lista los lotes previos del usuario con fecha, tipo y resumen (total/reconocidos/creados/omitidos), ordenados del más reciente al más antiguo.
- [ ] `/importar/[batchId]` muestra todas las filas de `imdb_import_rows` del lote con su resultado, y solo es accesible por el dueño del lote.
- [ ] Cada fila con resultado `skipped` es identificable visualmente (color/badge distinto).

---

## RIK-6 — Mis suscripciones

**Descripción:** Vista `/suscripciones` para declarar el servicio de streaming activo (plataforma + país) y ver el historial de suscripciones anteriores, sobre la tabla `user_subscriptions` (modelo `started_on`/`ended_on`, sin estadísticas de aprovechamiento — eso es Fase 2).

**Criterios de aceptación:**
- [ ] Activar una nueva suscripción para una plataforma/país cierra automáticamente (`ended_on = hoy`) cualquier suscripción abierta previa para esa misma plataforma+país.
- [ ] Es posible tener más de una suscripción activa simultánea si son plataforma/país distintos.
- [ ] El historial muestra todas las suscripciones pasadas del usuario con sus fechas, ordenadas de más reciente a más antigua.
- [ ] Sin ninguna suscripción activa, el panel principal (RIK-7) muestra el estado vacío correspondiente en vez de fallar.

---

## RIK-7 — Panel principal ("Qué ver este mes")

**Descripción:** Vista de aterrizaje `/panel` con el cruce central del producto: watchlist ∩ disponible en el servicio activo ∩ no visto, ordenado por calificación IMDb (consulta 8.1 del esquema). Incluye encabezado con servicio/país activo, contador de coincidencias, cuadrícula de resultados y acción de marcar visto directo desde la tarjeta.

**Criterios de aceptación:**
- [ ] La cuadrícula solo muestra títulos que están en la watchlist del usuario, disponibles (`is_available = true`) en su suscripción activa, y no marcados como vistos ni descartados.
- [ ] El contador refleja exactamente la cantidad de tarjetas mostradas.
- [ ] Marcar "visto" desde una tarjeta la quita de la lista sin recargar la página completa.
- [ ] Sin suscripción activa declarada, se muestra un estado vacío con botón directo a `/suscripciones`.
- [ ] La carga inicial se siente instantánea con un historial de varios miles de títulos (verificar con datos de prueba de volumen realista).

---

## RIK-8 — Recomendaciones por descubrimiento

**Descripción:** Vista `/recomendaciones` con dos bloques: (a) subconjunto de la watchlist disponible ahora (reuso de la consulta del panel), y (b) descubrimiento — títulos bien calificados, disponibles, no vistos y fuera de la watchlist (consulta 8.2 del esquema), con filtro por género y acción de descartar (`dismissed`).

**Criterios de aceptación:**
- [ ] El bloque "Descubre algo nuevo" nunca incluye títulos ya en la watchlist, ya vistos, o descartados.
- [ ] El bloque respeta el umbral mínimo de calificación y de votos definido en la consulta 8.2 (evita títulos con pocos votos).
- [ ] El filtro de género reduce ambos bloques a títulos que incluyen ese género.
- [ ] "No me interesa" marca `dismissed = true` y el título no vuelve a aparecer en recomendaciones (verificar recarga).
- [ ] "Agregar a watchlist" desde una tarjeta de descubrimiento la mueve al primer bloque en la siguiente carga.

---

## RIK-9 — Ficha de título y marcado manual

**Descripción:** Vista autenticada `/titulo/[slug]` con poster, sinopsis, año, calificación IMDb y votos, géneros, elenco, calificación personal si existe, y sección "Dónde ver" listando plataformas disponibles con enlace, destacando la que coincide con la suscripción activa. Incluye las acciones de marcado manual (visto/no visto, agregar/quitar de watchlist) sin depender de reimportar CSV, y el estado especial para títulos `is_stub`.

**Criterios de aceptación:**
- [ ] Marcar/desmarcar visto y agregar/quitar de watchlist desde la ficha actualiza `user_media_status` con `manually_edited = true` y `source = 'manual'`.
- [ ] La sección "Dónde ver" solo lista plataformas con `is_available = true` para ese título, y resalta la que coincide con la suscripción activa del usuario.
- [ ] Un título con `is_stub = true` muestra un aviso de "información limitada" y no rompe el layout por falta de poster/sinopsis/elenco.
- [ ] La ficha es alcanzable por click desde el panel, recomendaciones y listas propias.

---

## RIK-10 — Mis listas

**Descripción:** Gestión libre de listas propias: `/mis-listas` (listado con nombre, cantidad de títulos, badge de visibilidad, crear nueva) y `/mis-listas/[slug]` (detalle con títulos, reordenamiento, cambio de visibilidad y copiar enlace si es pública), sobre `user_lists`/`list_items`.

**Criterios de aceptación:**
- [ ] Un usuario puede crear, renombrar, eliminar una lista, y agregar/quitar títulos (desde la lista o desde la ficha de título).
- [ ] Cambiar el switch de visibilidad de una lista a pública genera de inmediato un enlace compartible funcional (ver RIK-11); cambiarla a privada invalida el acceso público en la siguiente carga.
- [ ] Reordenar títulos dentro de una lista persiste el `sort_order` y se refleja tras recargar.
- [ ] Un usuario no puede ver ni editar listas de otro usuario que no sean públicas (verificar con dos cuentas).

---

## RIK-11 — Lista pública y ficha de título pública (sin sesión)

**Descripción:** Rutas bajo `(public)`: `/l/[codigo]` para ver una lista pública sin necesidad de cuenta, y la variante pública de `/titulo/[slug]` sin las acciones que requieren sesión. Por la Sección 9.2 del esquema, el identificador público de una lista debe ser distinto del `slug` interno (único solo por usuario) para no chocar entre cuentas cuando se abra multiusuario — usar un código corto propio para el enlace público.

**Criterios de aceptación:**
- [ ] `/l/[codigo]` es accesible sin sesión iniciada (ventana de incógnito) y no pasa por el guard de `(app)`.
- [ ] La vista pública muestra solo nombre, descripción y cuadrícula de títulos de esa lista — ningún dato del resto de la cuenta del dueño (ni historial, ni suscripciones, ni otras listas).
- [ ] Marcar la lista como privada hace que `/l/[codigo]` deje de resolver (404 o equivalente) para cualquier visitante que no sea el dueño.
- [ ] Desde `/l/[codigo]`, click en un título lleva a la variante pública de `/titulo/[slug]`, sin botones de "marcar visto" ni "agregar a lista"; esos controles, si se muestran, llevan a login en vez de ejecutar la acción.
- [ ] El código público es único globalmente (no reutiliza el `slug` interno de `user_lists`).

---

## Fuera de alcance para v1

Explícitamente pospuesto a Fase 2/3 según la Sección 12 del PRD — no crear tareas para esto todavía:

- Filtros y buscador completos en "Mi biblioteca" (vista de exploración general del historial).
- Estadística de aprovechamiento por servicio contratado.
- Enriquecimiento automático de títulos `is_stub` (poster/sinopsis/elenco).
- Registro multiusuario abierto, descubrimiento entre usuarios, perfiles públicos.
- Seguimiento a nivel de episodio y alertas de "sale del catálogo pronto".

## Pendientes de producto que bloquean a nivel de datos

Ver Sección 13 del PRD y Sección 11 del esquema — no bloquean el arranque de RIK-1 a RIK-11, pero deben resolverse antes de dar por cerrada la Fase 1:

- Catálogo completo de series desde el proceso externo (hoy solo entrega derivados) — afecta la cobertura real de RIK-3 para series.
- Confirmar que el proceso externo deje de precalcular listas derivadas y entregue solo catálogo crudo (condición para que RIK-7/RIK-8 tengan sentido como cálculo vivo en la app).
- Política de reconciliación cuando un título sale de la watchlist de IMDb pero sigue `want_to_watch` en la app (RIK-4).

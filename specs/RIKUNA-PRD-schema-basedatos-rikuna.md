# Rikuna — Esquema de Base de Datos v3

> Reemplaza la versión anterior. Cambios de esta versión: se define el proyecto como **Rikuna**, y se corrige el modelo de visibilidad de `user_lists` — las listas públicas deben poder verse **sin sesión iniciada**, no solo "más adelante en la etapa multiusuario" como decía la v2 (ver Sección 9.2). El resto de la base (suscripción activa, disponibilidad verificada en el tiempo, importación de IMDb que crea títulos) se mantiene igual que en la v2.

PostgreSQL / Supabase. Multiusuario desde el diseño aunque la Etapa 1 sea de un solo usuario.

---

## 1. Resumen de cambios respecto a la v1

| Cambio | Motivo |
|---|---|
| **Nueva** `user_subscriptions` | No existía forma de saber qué servicio tienes contratado — es el disparador de toda la lógica |
| `media_links` → **`media_availability`** | Los catálogos rotan mensualmente; se necesita saber *cuándo se verificó* y detectar lo que salió |
| **Nueva** `catalog_snapshots` | Cada carga del proceso externo es una foto del catálogo en un momento; permite detectar bajas |
| `media_items` gana `is_stub` y `title_type` | Los títulos creados desde CSV llegan incompletos y deben marcarse como tales |
| Importación **crea** títulos | Antes se descartaban con `not_found`, lo que habría perdido gran parte de la watchlist |
| `user_media_status` gana `dismissed` | Para poder descartar recomendaciones sin marcarlas como vistas |

---

## 2. Catálogo

### 2.1 `media_items`

```sql
create table if not exists public.media_items (
    id              uuid        default gen_random_uuid() not null primary key,
    created_at      timestamptz default now() not null,
    updated_at      timestamptz default now() not null,

    imdb_id         varchar not null,          -- tconst, ej. "tt0111161" — identificador universal
    tmdb_id         integer,

    type            varchar not null,          -- 'movie' | 'tv'
    title_type      varchar,                   -- valor crudo de IMDb: movie, tvSeries, tvMiniSeries, short, tvMovie
    title           varchar not null,
    original_title  varchar,
    slug            varchar not null,
    year            integer,
    end_year        integer,
    runtime_minutes integer,
    description     text,
    poster_url      text,
    content_rating  varchar,                   -- clasificación por edad; NO es la calificación de IMDb

    imdb_rating     numeric(3,1),
    imdb_votes      integer,
    imdb_url        text,

    -- Control de completitud
    is_stub         boolean default false not null,  -- creado desde CSV, faltan poster/sinopsis/elenco
    enriched_at     timestamptz,

    metadata        jsonb default '{}'::jsonb not null,

    constraint media_items_imdb_id_uq unique (imdb_id),
    constraint media_items_slug_uq unique (slug)
);

create index if not exists media_items_type_idx on public.media_items (type);
create index if not exists media_items_rating_idx on public.media_items (imdb_rating desc nulls last);
create index if not exists media_items_stub_idx on public.media_items (is_stub) where is_stub;

create or replace trigger media_items_updated_at
    before update on public.media_items
    for each row execute function public.handle_updated_at();
```

> `is_stub` es clave: cuando importas tu watchlist y un título no existe en el catálogo, **se crea igual** con lo que trae el CSV (título, año, imdb_id, calificación). Queda marcado como incompleto para que un proceso posterior le agregue poster, sinopsis y elenco. Sin esto, perderías la mayor parte de tu watchlist histórica.

### 2.2 Géneros y personas

```sql
create table if not exists public.genres (
    id   uuid default gen_random_uuid() not null primary key,
    name varchar not null,
    slug varchar not null unique
);

create table if not exists public.media_genres (
    media_id uuid not null references public.media_items(id) on delete cascade,
    genre_id uuid not null references public.genres(id) on delete cascade,
    primary key (media_id, genre_id)
);
create index if not exists media_genres_genre_idx on public.media_genres (genre_id);

create table if not exists public.people (
    id      uuid default gen_random_uuid() not null primary key,
    imdb_id varchar unique,     -- nconst
    name    varchar not null,
    photo_url text
);

create table if not exists public.media_people (
    media_id       uuid not null references public.media_items(id) on delete cascade,
    person_id      uuid not null references public.people(id) on delete cascade,
    role           varchar not null,   -- 'actor' | 'director' | 'writer' | 'creator'
    character_name varchar,
    sort_order     integer default 0 not null,
    primary key (media_id, person_id, role)
);
create index if not exists media_people_media_idx on public.media_people (media_id, sort_order);
```

### 2.3 Series: temporadas y episodios

Se mantiene igual que en tu esquema actual (`seasons`, `episodes` con FK a `media_items`). No se detalla aquí porque no cambia y no forma parte del MVP.

---

## 3. Plataformas y disponibilidad

### 3.1 `platforms`

```sql
create table if not exists public.platforms (
    id                uuid default gen_random_uuid() not null primary key,
    name              varchar not null,          -- "Apple TV+"
    slug              varchar not null unique,   -- "apple-tv-plus"
    logo_url          text,
    provider_id_movie integer,   -- ids que ya trae tu proceso externo en metadata
    provider_id_tv    integer
);
```

### 3.2 `catalog_snapshots` — cada archivo cargado del proceso externo

```sql
create table if not exists public.catalog_snapshots (
    id           uuid default gen_random_uuid() not null primary key,
    created_at   timestamptz default now() not null,
    platform_id  uuid not null references public.platforms(id) on delete cascade,
    country      varchar(2) not null,          -- "BO"
    generated_at timestamptz not null,         -- metadata.generated_at del archivo
    source_file  varchar,                      -- "apple-tv-plus_BO.json"
    total_items  integer default 0 not null,
    status       varchar default 'pending' not null  -- 'pending' | 'completed' | 'failed'
);

create index if not exists catalog_snapshots_platform_idx
    on public.catalog_snapshots (platform_id, country, generated_at desc);
```

### 3.3 `media_availability` — dónde está disponible cada título

```sql
create table if not exists public.media_availability (
    id               uuid default gen_random_uuid() not null primary key,
    media_id         uuid not null references public.media_items(id) on delete cascade,
    platform_id      uuid not null references public.platforms(id) on delete cascade,
    country          varchar(2) not null,
    url              text,                  -- enlace directo si existe; si no, página del servicio
    offer_type       varchar default 'subscription' not null,  -- 'subscription' | 'rent' | 'buy'

    is_available     boolean default true not null,
    first_seen_at    timestamptz default now() not null,
    last_seen_at     timestamptz default now() not null,
    last_snapshot_id uuid references public.catalog_snapshots(id),

    constraint media_availability_uq unique (media_id, platform_id, country, offer_type)
);

create index if not exists media_availability_lookup_idx
    on public.media_availability (platform_id, country, is_available);
create index if not exists media_availability_media_idx
    on public.media_availability (media_id) where is_available;
```

**Lógica de ingesta (esto es lo que hace que funcione la rotación mensual):**

1. Se crea un `catalog_snapshots` con los datos de `metadata` del archivo.
2. Por cada título del catálogo crudo: *upsert* en `media_items` por `imdb_id`, y *upsert* en `media_availability` con `is_available = true`, `last_seen_at = generated_at` y `last_snapshot_id = <snapshot actual>`.
3. **Al terminar**, todo lo que en esa plataforma+país tenga un `last_snapshot_id` distinto al snapshot recién procesado se marca `is_available = false`. Eso es lo que detecta los títulos que **salieron** del catálogo.

```sql
-- Paso 3: marcar como no disponible lo que ya no apareció
update public.media_availability
set is_available = false
where platform_id = :platform_id
  and country     = :country
  and (last_snapshot_id is distinct from :snapshot_id)
  and is_available;
```

---

## 4. Suscripciones del usuario

```sql
create table if not exists public.user_subscriptions (
    id          uuid default gen_random_uuid() not null primary key,
    created_at  timestamptz default now() not null,
    updated_at  timestamptz default now() not null,
    user_id     uuid not null references auth.users(id) on delete cascade,
    platform_id uuid not null references public.platforms(id) on delete restrict,
    country     varchar(2) not null,
    started_on  date not null default current_date,
    ended_on    date,                              -- null = vigente
    notes       text
);

-- Puedes tener varias activas a la vez (si pagas dos servicios), pero no
-- dos filas abiertas para la misma plataforma+país
create unique index if not exists user_subscriptions_active_uq
    on public.user_subscriptions (user_id, platform_id, country)
    where ended_on is null;

create index if not exists user_subscriptions_active_idx
    on public.user_subscriptions (user_id) where ended_on is null;

create or replace trigger user_subscriptions_updated_at
    before update on public.user_subscriptions
    for each row execute function public.handle_updated_at();
```

> Se modela como **historial** (`started_on` / `ended_on`) y no como un simple campo "plataforma actual". Así puedes responder después "¿qué vi durante el mes que tuve Netflix?" y medir el aprovechamiento de cada suscripción.

---

## 5. Estado personal por título

```sql
create table if not exists public.user_media_status (
    id                uuid default gen_random_uuid() not null primary key,
    created_at        timestamptz default now() not null,
    updated_at        timestamptz default now() not null,
    user_id           uuid not null references auth.users(id) on delete cascade,
    media_id          uuid not null references public.media_items(id) on delete cascade,

    watched           boolean default false not null,
    watched_at        timestamptz,          -- "Date Rated" del CSV de calificaciones
    personal_rating   smallint,             -- "Your Rating" (1-10)

    want_to_watch     boolean default false not null,   -- viene de la lista de seguimiento de IMDb
    want_added_at     timestamptz,

    dismissed         boolean default false not null,   -- "no me interesa" — se excluye de recomendaciones

    source            varchar default 'manual' not null, -- 'manual' | 'imdb_ratings' | 'imdb_watchlist'
    manually_edited   boolean default false not null,    -- protege contra sobrescritura al reimportar

    constraint user_media_status_uq unique (user_id, media_id),
    constraint user_media_status_rating_chk check (personal_rating between 1 and 10)
);

create index if not exists ums_user_watched_idx on public.user_media_status (user_id, watched);
create index if not exists ums_user_want_idx on public.user_media_status (user_id, want_to_watch) where want_to_watch;

create or replace trigger user_media_status_updated_at
    before update on public.user_media_status
    for each row execute function public.handle_updated_at();
```

**Reglas de negocio importantes:**

- `watched` y `want_to_watch` son **independientes**: un título puede estar en tu lista de seguimiento y además ya visto (pasa si lo viste pero nunca lo quitaste de IMDb). En ese caso `watched` manda y no aparece en "Qué ver este mes".
- `manually_edited = true` protege lo que marcaste a mano en la app para que una reimportación no lo pise.
- `dismissed` permite descartar una recomendación sin mentir diciendo que la viste.

---

## 6. Listas propias del usuario

```sql
create table if not exists public.user_lists (
    id          uuid default gen_random_uuid() not null primary key,
    created_at  timestamptz default now() not null,
    updated_at  timestamptz default now() not null,
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        varchar not null,
    slug        varchar not null,
    description text,
    is_public   boolean default false not null,   -- false = solo el dueño la ve; true = visible por enlace, incluso sin sesión (ver Sección 9.2)
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

---

## 7. Importación desde IMDb

### 7.1 Tablas

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

### 7.2 Columnas de los CSV de IMDb

| Columna del CSV | Destino |
|---|---|
| `Const` | `imdb_id` — llave de cruce |
| `Title` | `media_items.title` |
| `Title Type` | `media_items.title_type` → deriva `type` ('movie' / 'tv') |
| `Year` | `media_items.year` |
| `IMDb Rating` | `media_items.imdb_rating` |
| `Num Votes` | `media_items.imdb_votes` |
| `Runtime (mins)` | `media_items.runtime_minutes` |
| `Genres` | `genres` + `media_genres` |
| `Directors` | `people` + `media_people` (rol 'director') |
| `Your Rating` | `user_media_status.personal_rating` |
| `Date Rated` | `user_media_status.watched_at` |

### 7.3 Lógica de procesamiento

**CSV de calificaciones (`ratings`) → lo que YA VISTE:**
1. Buscar `media_items` por `imdb_id`. Si no existe → **crear** con los datos del CSV, `is_stub = true`, `result = 'created'`. Si existe → `result = 'matched'`.
2. Upsert en `user_media_status`: `watched = true`, `watched_at = Date Rated`, `personal_rating = Your Rating`, `source = 'imdb_ratings'`.
3. **No sobrescribir** filas con `manually_edited = true`, salvo para agregar la calificación si estaba vacía.

**CSV de lista de seguimiento (`watchlist`) → lo que QUIERES VER:**
1. Mismo paso 1 (crear stub si no existe).
2. Upsert en `user_media_status`: `want_to_watch = true`, `want_added_at`, `source = 'imdb_watchlist'`.
3. **No** tocar `watched` — si ya estaba marcado como visto, se respeta.

**Reconciliación de bajas (decisión pendiente):** cuando un título estaba en `want_to_watch` por una importación previa y ya no aparece en el archivo nuevo, hay dos opciones: (a) desmarcarlo automáticamente, o (b) conservarlo y solo reportarlo. Recomiendo **(b)** en la etapa inicial, para no perder datos por un archivo mal exportado.

---

## 8. Consultas clave del producto

### 8.1 "Qué ver este mes" — watchlist ∩ disponible en tu servicio ∩ no visto

```sql
select distinct mi.*
from public.media_items mi
join public.user_media_status ums
     on ums.media_id = mi.id
    and ums.user_id = auth.uid()
    and ums.want_to_watch
    and not ums.watched
    and not ums.dismissed
join public.media_availability ma
     on ma.media_id = mi.id
    and ma.is_available
join public.user_subscriptions us
     on us.platform_id = ma.platform_id
    and us.country     = ma.country
    and us.user_id     = auth.uid()
    and us.ended_on is null
order by mi.imdb_rating desc nulls last;
```

### 8.2 Recomendaciones por descubrimiento — bueno, disponible, no visto, fuera de la watchlist

```sql
select distinct mi.*
from public.media_items mi
join public.media_availability ma
     on ma.media_id = mi.id and ma.is_available
join public.user_subscriptions us
     on us.platform_id = ma.platform_id
    and us.country     = ma.country
    and us.user_id     = auth.uid()
    and us.ended_on is null
left join public.user_media_status ums
     on ums.media_id = mi.id and ums.user_id = auth.uid()
where coalesce(ums.watched,       false) = false
  and coalesce(ums.want_to_watch, false) = false
  and coalesce(ums.dismissed,     false) = false
  and mi.imdb_rating >= 7.0
  and mi.imdb_votes  >= 5000        -- evita "joyas" falsas con muy pocos votos
order by mi.imdb_rating desc
limit 50;
```

### 8.3 "Aún no he visto" (global, sin filtrar por plataforma)

```sql
select mi.*
from public.media_items mi
left join public.user_media_status ums
     on ums.media_id = mi.id and ums.user_id = auth.uid()
where coalesce(ums.watched, false) = false;
```

---

## 9. Seguridad por fila (RLS)

| Tabla | Lectura | Escritura |
|---|---|---|
| `media_items`, `genres`, `people`, `platforms`, `media_availability`, `catalog_snapshots` | Pública (incluye visitantes sin sesión) | Solo admin / proceso de ingesta |
| `user_subscriptions` | Solo el dueño | Solo el dueño |
| `user_media_status` | Solo el dueño | Solo el dueño |
| `user_lists` | **Pública si `is_public = true` (incluye visitantes sin sesión); privada solo para el dueño si `is_public = false`** | Solo el dueño |
| `list_items` | Hereda de la lista | Dueño de la lista |
| `imdb_import_batches`, `imdb_import_rows` | Solo el dueño | Solo el dueño |

### 9.1 Patrón para tablas 100% privadas

```sql
create policy "owner_all" on public.user_media_status
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 9.2 `user_lists` y `list_items` — el caso mixto (público/privado)

Esta es la tabla que le da al usuario control real de qué comparte. La condición `is_public or auth.uid() = user_id` funciona igual para un visitante sin sesión que para el dueño autenticado: si no hay sesión, `auth.uid()` es nulo y la condición se resuelve únicamente por `is_public`.

```sql
alter table public.user_lists enable row level security;
alter table public.list_items enable row level security;

-- Lectura: pública si is_public=true (incluye rol "anon", es decir sin sesión),
-- o si el que consulta es el dueño
create policy "user_lists_select" on public.user_lists
    for select using (is_public or auth.uid() = user_id);

create policy "user_lists_write" on public.user_lists
    for insert with check (auth.uid() = user_id);
create policy "user_lists_update" on public.user_lists
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_lists_delete" on public.user_lists
    for delete using (auth.uid() = user_id);

-- list_items hereda la visibilidad de su lista padre
create policy "list_items_select" on public.list_items
    for select using (
        exists (
            select 1 from public.user_lists l
            where l.id = list_items.list_id
              and (l.is_public or l.user_id = auth.uid())
        )
    );

create policy "list_items_write" on public.list_items
    for all using (
        exists (select 1 from public.user_lists l where l.id = list_items.list_id and l.user_id = auth.uid())
    ) with check (
        exists (select 1 from public.user_lists l where l.id = list_items.list_id and l.user_id = auth.uid())
    );

-- El rol "anon" (visitante sin sesión) necesita el grant, además de la policy;
-- sin este grant, RLS nunca llega a evaluarse y el visitante no ve nada
grant select on public.user_lists  to anon, authenticated;
grant select on public.list_items  to anon, authenticated;
```

> **Importante a nivel de aplicación, no solo de base de datos:** que la base de datos permita la lectura pública no alcanza. La ruta que muestra una lista pública (`/l/[slug]` o similar) debe quedar **fuera** del grupo de rutas que exige sesión iniciada — si el middleware de autenticación redirige a `/login` a cualquiera sin sesión antes de llegar a esa página, la política de RLS nunca llega a ejecutarse porque la petición ni siquiera pasa. Ambas capas tienen que estar de acuerdo: la ruta pública y la política de RLS pública son dos piezas del mismo mecanismo.

---

## 10. Mapa de relaciones

```
media_items ──< media_genres      >── genres
media_items ──< media_people      >── people
media_items ──< media_availability>── platforms
                        └──> catalog_snapshots

auth.users ──< user_subscriptions >── platforms
auth.users ──< user_media_status  >── media_items
auth.users ──< user_lists ──< list_items >── media_items
auth.users ──< imdb_import_batches ──< imdb_import_rows >── media_items
```

**El cruce central del producto** es la intersección de tres caminos:
`user_media_status` (lo que quiero / ya vi) × `media_availability` (dónde está) × `user_subscriptions` (qué pago hoy).

---

## 11. Pendientes que afectan al esquema

1. **Catálogo completo de series:** el proceso externo debe entregar `series.catalog` completo, no solo listas derivadas. Sin eso, `media_availability` quedará incompleta para series.
2. **Enlaces directos por título:** definir si el proceso puede obtener el enlace profundo dentro de cada servicio; si no, `media_availability.url` apuntará a la página general de la plataforma.
3. **Enriquecimiento de stubs:** definir el proceso que completa poster, sinopsis y elenco de los títulos creados desde CSV (`is_stub = true`).
4. **Política de bajas en watchlist:** confirmar la opción recomendada en 7.3.
5. **Tipos de oferta:** confirmar si interesa distinguir suscripción de alquiler/compra (`offer_type`) o si solo importa lo incluido en la suscripción.
6. **Slug de las listas públicas:** hoy `slug` es único solo por usuario (`user_lists_user_slug_uq`), lo cual es correcto para el uso interno, pero el enlace público (ej. `rikuna.app/l/<slug>`) necesita ser único a nivel global para no chocar entre listas de distintos usuarios cuando se abra la Etapa 3 multiusuario — conviene resolverlo generando el enlace público con un identificador aparte (ej. un código corto) en vez de reusar el `slug` interno.

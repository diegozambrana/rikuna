-- ---------------------------------------------------------------------------
-- Seed public.platforms with the main streaming services for Rikuna's target
-- markets (constants/countries.ts: LatAm + ES + US).
--
-- Until now the table was only populated lazily, by
-- ingestion/catalog/resolvePlatform.ts on the first catalog file for a given
-- platform. That left /suscripciones with an empty platform picker on any
-- database that hasn't ingested a catalog yet, so the reference data is seeded
-- here instead. Kept in sync with constants/platforms.ts (KNOWN_PLATFORMS).
--
-- Idempotent: slug is unique, and re-running leaves existing rows (and any
-- provider ids the ingestion process has filled in) untouched.
-- ---------------------------------------------------------------------------
insert into public.platforms (slug, name)
values
    ('netflix',            'Netflix'),
    ('amazon-prime-video', 'Amazon Prime Video'),
    ('disney-plus',        'Disney+'),
    ('hbo-max',            'HBO Max'),
    ('apple-tv-plus',      'Apple TV+'),
    ('paramount-plus',     'Paramount+'),
    ('crunchyroll',        'Crunchyroll'),
    ('mubi',               'MUBI'),
    ('vix',                'ViX'),
    ('movistar-plus',      'Movistar Plus+'),
    ('filmin',             'Filmin'),
    ('claro-video',        'Claro Video')
on conflict (slug) do nothing;

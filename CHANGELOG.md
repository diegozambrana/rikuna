# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) when releases are tagged.

Detailed implementation logs (date, files, acceptance criteria, decisions) live in [`specs/logs/`](specs/logs/). Filename format: `YYYYMMDDHHmm_<TICKET-ID>_<slug>.md`.

## [Unreleased]

### Added

<!-- New features. One bullet per ticket: `- RIK-XXX: Short user-facing summary` -->
- RIK-1: Added the secured database foundation for Rikuna — the streaming catalog, per-user watch data, subscriptions, lists, and IMDb import history now have a real, access-controlled home.
- RIK-2: Added account sign-up, login, logout, and password recovery, plus the private/public area split so shared lists will stay reachable without an account.
- RIK-4: Added importing your ratings and watchlist from IMDb — upload a CSV export and see matched, newly added, and skipped titles right away.
- RIK-3: Added the routine that loads a streaming platform's monthly catalog file into Rikuna, keeping availability current and marking titles that rotated out instead of losing their history.
- RIK-5: Added an import history list on Importar and a per-import detail page showing exactly what happened to every row of a past CSV upload.
- RIK-6: Added the Mis suscripciones screen — declare which streaming service and country you currently pay for, see all your active subscriptions at once, and review your full subscription history.
- RIK-7: Added the main panel ("Qué ver este mes") — see, at a glance, which titles from your watchlist are available right now on the service you pay for, and mark them watched with one tap.
- RIK-8: Added the Recomendaciones screen — see watchlist titles now available next to a "Descubre algo nuevo" section of well-rated, unseen titles, filterable by genre, with one-tap add-to-watchlist and "no me interesa" actions.
- RIK-9: Added the title detail page — poster, synopsis, rating, genres, cast, and "Dónde ver" with your active service highlighted, plus one-tap watched/watchlist toggles and a read-only public view for visitors without an account.
- RIK-10: Added Mis listas — create, rename, and delete your own lists, add or remove titles, drag to reorder, and toggle a list public or private, with a share-link button that's ready for when public sharing ships.
- RIK-11: Added public list sharing — publishing a list now produces a real shareable link that opens the list, and the titles in it, for anyone without a Rikuna account.
- RIK-12: Added the app shell — a header with an account menu (profile, theme toggle, sign out) and a collapsible sidebar for navigating between Panel, Recomendaciones, Mi biblioteca, Mis listas, Mis suscripciones, and Importar, with a mobile-friendly slide-out menu.
- RIK-13: Added the Inicio (marketing home) page at `/` — hero, how-it-works, trust section, and a minimal footer for visitors without a session, who are now redirected to Panel automatically if they're already logged in.
- RIK-14: Added Mi biblioteca — browse your entire personal watch history in a sortable, paginated table with tabs (Vistas / Quiero ver / Todas), filters for type, genre, year range, minimum rating and active-subscription availability, and a title search box, all reflected in the page's URL.
- RIK-15: Added the Perfil screen — see your account name and email, switch between light and dark mode, and sign out.
- RIK-17: Added Sincronizar enlaces — look up where every title in your catalog can be watched, fill in availability for the countries Rikuna supports, and get a run summary listing what was updated, which titles failed and why, and which streaming providers were skipped for not being in your platform list. "Dónde ver" links now go straight to the title on the streaming service itself.

### Changed

<!-- Changes in existing functionality -->
- RIK-17: "Dónde ver" on a title page now shows one badge per platform instead of one per country and offer type, labelled with the country and whether it's rental or purchase, ordered with your active subscriptions first.
- RIK-17: Title cards on Qué ver este mes and Recomendaciones now open the title's detail page when clicked. The "marcar como visto", "agregar a watchlist" and "no me interesa" buttons keep working as before.
- RIK-17: The IMDb rating on a title page is now a link to that title on IMDb, opening in a new tab. Titles with no rating yet get an "IMDb" badge in its place.
- RIK-19: Added Explorar — browse the entire Rikuna catalog as a sortable table or a poster grid, filtered by title, type, genre, streaming platform (and the country it's available in), year range and minimum rating. The chosen view and every filter live in the page's URL, so a search can be bookmarked or shared.
- RIK-18: Importar now accepts a CSV containing nothing but IMDb ids — one `imdb_id` (or `Const`, `tconst`, …) column, or even a bare list with no header row. Title, year, poster, genres and cast are filled in from TMDB right after, so a hand-made list of ids is enough to build a library. Full IMDb exports keep working unchanged.

### Fixed

<!-- Bug fixes -->
- RIK-19: Series are no longer listed as films. The TMDB sync knows whether a title is a movie or a series but never wrote it back, so anything whose type couldn't be inferred at import time stayed a "Película" forever — including Breaking Bad, Chernobyl and Juego de tronos.
- RIK-19: The filter dropdowns on Mi biblioteca showed internal placeholder text (`__all_types__`) instead of "Todos" until something was selected.
- RIK-17: The "Dónde ver" badges are now real links that open the title on the streaming service in a new tab. They were rendering as plain text because the watch link was being read off the platform instead of the availability row.

### Removed

<!-- Removed features or files -->

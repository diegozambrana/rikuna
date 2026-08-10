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

### Changed

<!-- Changes in existing functionality -->

### Fixed

<!-- Bug fixes -->

### Removed

<!-- Removed features or files -->

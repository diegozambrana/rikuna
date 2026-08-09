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

### Changed

<!-- Changes in existing functionality -->

### Fixed

<!-- Bug fixes -->

### Removed

<!-- Removed features or files -->

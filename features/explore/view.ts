/**
 * The Explorar layout modes, plus the parser for the `vista` search param.
 *
 * Deliberately NOT in ExploreViewToggle.tsx: that file is `"use client"`, and
 * a Server Component importing a non-function export from a client module
 * receives a client reference rather than the value — `EXPLORE_VIEWS.includes`
 * would be undefined at request time even though it type-checks and builds.
 * This module carries no directive, so both sides get the real thing.
 */
export type ExploreView = "lista" | "cuadricula"

export const EXPLORE_VIEWS: ExploreView[] = ["lista", "cuadricula"]

/** Anything unrecognized falls back to the list, which is the default view. */
export function parseExploreView(value?: string): ExploreView {
  return (EXPLORE_VIEWS as string[]).includes(value ?? "") ? (value as ExploreView) : "lista"
}

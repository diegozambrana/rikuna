import type { ImdbImportSummary } from "@/ingestion/imdb-import"

export type ImdbImportActionState =
  | { status: "idle" }
  | { status: "success"; summary: ImdbImportSummary }
  | { status: "error"; message: string }

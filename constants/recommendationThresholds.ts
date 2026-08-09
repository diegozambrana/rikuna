// Discovery query (schema-basedatos-rikuna.md Section 8.2) thresholds for
// "well rated" — mirrors the `thresholds` block the external availability
// process already produces, so both sides agree on what counts as well rated.
export const RECOMMENDATION_THRESHOLDS = {
  minRating: 7.0,
  minImdbVotes: 5000,
  // Mirrors minImdbVotes today; reserved for a future tunable minImdbVotes
  // without a hardcoded floor. Not exercised by RIK-8's own logic.
  minVotesFloor: 5000,
} as const

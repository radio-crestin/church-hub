/** Rows taken from the index per tier before they are scored in JS. */
export const CANDIDATES_PER_TIER = 300

/**
 * Above this many matches the index is not asked to rank (BM25 over every
 * match costs tens of milliseconds) and hands back its first rows in stored
 * order instead. A query that broad is a word or two still being typed,
 * where any of its matches is as good as another until the next letter.
 */
export const MAX_RANKED_MATCHES = 2000

import { buildMatchTiers, type MatchTiers } from './buildMatchTiers'
import { buildTermGroups, type SynonymsOf } from './buildTermGroups'
import { buildVariantMatcher, type VariantMatcher } from './buildVariantMatcher'
import { foldSearchText } from './foldSearchText'
import { scoreTextMatch } from './scoreTextMatch'
import { splitWordUnits } from './splitWordUnits'
import type { TermGroup, TextMatchScore } from './types'
import { getVocabulary } from './vocabularyStore'

/** A query understood once, ready to find candidates and score texts. */
export interface TextQuery {
  groups: TermGroup[]
  /** The FTS5 queries that find candidates (see `buildMatchTiers`). */
  tiers: MatchTiers
  /** Scores a text (as stored, any case and diacritics) against the query. */
  score: (text: string) => TextMatchScore
}

/**
 * The shared search engine's entry point, used by the Bible and the songs
 * alike: the query's words with their typo and spelling variants, looked up
 * in the vocabulary of `ftsTable`, plus any synonyms the caller knows.
 */
export function prepareTextQuery(
  query: string,
  ftsTable: string,
  synonymsOf: SynonymsOf = () => [],
): TextQuery {
  const groups = buildTermGroups(query, getVocabulary(ftsTable), synonymsOf)
  const matcher: VariantMatcher = buildVariantMatcher(groups)
  return {
    groups,
    tiers: buildMatchTiers(groups),
    score: (text) =>
      scoreTextMatch(splitWordUnits(foldSearchText(text)), groups, matcher),
  }
}

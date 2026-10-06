import { buildTermGroup } from './buildTermGroup'
import { foldSearchText } from './foldSearchText'
import { splitWordUnits } from './splitWordUnits'
import type { TermGroup, Vocabulary } from './types'

/** The other words a searcher means by a word, e.g. "cristos" → ["hristos"]. */
export type SynonymsOf = (word: string) => string[]

/**
 * A query as term groups, one per typed word. The last word is matched as a
 * beginning until the user types a space after it. A query of nothing but
 * short words still looks up its two-letter ones, so "la" finds something.
 */
export function buildTermGroups(
  query: string,
  vocabulary: Vocabulary,
  synonymsOf: SynonymsOf,
): TermGroup[] {
  const units = splitWordUnits(foldSearchText(query))
  const stillTyping = !/\s$/u.test(query)
  const groups = units.map((unit, index) =>
    buildTermGroup(
      unit,
      stillTyping && index === units.length - 1,
      vocabulary,
      synonymsOf(unit).map(foldSearchText),
    ),
  )
  if (groups.some((group) => group.required)) return groups
  return groups.map((group) => ({
    ...group,
    required: group.typed.length >= 2,
  }))
}

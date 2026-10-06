import type { VariantMatcher } from './buildVariantMatcher'
import type { TermGroup, TextMatchScore } from './types'
import { wordUnitForms } from './wordUnitForms'

const NO_MATCH = 127
/** What one typo takes off a word's share of the score. */
const TYPO_COST = 0.2
/** A word the scoring only looks at (see `TermGroup.required`) counts this much. */
const OPTIONAL_WEIGHT_SHARE = 0.25
const COVERAGE_SHARE = 60
const PHRASE_SHARE = 40

/**
 * How well a text (its folded word units) matches the query's groups, 0–100.
 * Most of it is coverage: the words found, weighted by rarity, less their
 * typos. The rest is the longest stretch of query words found side by side
 * in query order, so the verse that holds the typed fragment as written beats
 * one that merely holds its words.
 */
export function scoreTextMatch(
  units: string[],
  groups: TermGroup[],
  matcher: VariantMatcher,
): TextMatchScore {
  const groupCount = groups.length
  const edits = new Int8Array(groupCount * units.length).fill(NO_MATCH)
  const best = new Int8Array(groupCount).fill(NO_MATCH)
  const matchedForms = new Set<string>()
  const atUnit = new Int8Array(groupCount)

  units.forEach((unit, position) => {
    atUnit.fill(NO_MATCH)
    for (const form of wordUnitForms(unit)) matcher(form, atUnit)
    let matched = false
    for (let group = 0; group < groupCount; group++) {
      const cost = atUnit[group]
      if (cost === NO_MATCH) continue
      matched = true
      edits[group * units.length + position] = cost
      if (cost < best[group]) best[group] = cost
    }
    if (matched) matchedForms.add(unit)
  })

  const phrase = longestPhrase(edits, groupCount, units.length)
  return {
    score: Math.round(
      COVERAGE_SHARE * coverage(groups, best) +
        PHRASE_SHARE * (phrase.length / groupCount),
    ),
    allFound: groups.every(
      (group, index) => !group.required || best[index] !== NO_MATCH,
    ),
    phraseStart: phrase.start,
    matchedForms: Array.from(matchedForms),
  }
}

function coverage(groups: TermGroup[], best: Int8Array): number {
  let found = 0
  let total = 0
  groups.forEach((group, index) => {
    const weight = group.weight * (group.required ? 1 : OPTIONAL_WEIGHT_SHARE)
    total += weight
    if (best[index] !== NO_MATCH) {
      found += weight * Math.max(0, 1 - TYPO_COST * best[index])
    }
  })
  return total > 0 ? found / total : 0
}

/**
 * The longest run of consecutive query words found at consecutive positions
 * of the text, and the position where it starts (-1 when nothing matched).
 */
function longestPhrase(
  edits: Int8Array,
  groupCount: number,
  unitCount: number,
): { length: number; start: number } {
  const run = new Int16Array(groupCount * unitCount)
  let length = 0
  let start = -1
  for (let group = 0; group < groupCount; group++) {
    for (let position = 0; position < unitCount; position++) {
      const at = group * unitCount + position
      if (edits[at] === NO_MATCH) continue
      const previous = group > 0 && position > 0 ? run[at - unitCount - 1] : 0
      run[at] = previous + 1
      if (run[at] > length) {
        length = run[at]
        start = position - run[at] + 1
      }
    }
  }
  return { length, start }
}

import {
  buildSearchQuery,
  calculateBestPhraseScoreNormalized,
  calculateTitleScoreNormalized,
  extractSearchTerms,
  getValidTerms,
  normalizeForIndex,
} from './search'
import { describe, expect, test } from 'bun:test'

describe('extractSearchTerms', () => {
  test('splits comma-separated words into separate terms', () => {
    // Bug: "Isus,Isus" was treated as single token "isus,isus" and filtered out
    const terms = extractSearchTerms('Isus,Isus noi te aşteptăm')
    expect(terms).toContain('isus')
    expect(terms).toContain('noi')
    expect(terms).toContain('te')
    expect(terms).toContain('asteptam')
  })

  test('handles various punctuation as separators', () => {
    expect(extractSearchTerms('word1.word2')).toEqual(['word1', 'word2'])
    expect(extractSearchTerms('word1;word2')).toEqual(['word1', 'word2'])
    expect(extractSearchTerms('word1!word2')).toEqual(['word1', 'word2'])
    expect(extractSearchTerms('word1?word2')).toEqual(['word1', 'word2'])
  })

  test('removes diacritics', () => {
    const terms = extractSearchTerms('aşteptăm')
    expect(terms).toEqual(['asteptam'])
  })

  test('deduplicates repeated terms', () => {
    // "Isus,Isus" should produce one "isus", not two
    const terms = extractSearchTerms('Isus,Isus noi te aşteptăm')
    const isusCount = terms.filter((t) => t === 'isus').length
    expect(isusCount).toBe(1)
  })

  test('drops single-character tokens (numeric prefix + "m-a" splits)', () => {
    // Regression: user-reported query "1. Cand Isus Hristos m-a mantuit"
    // used to tokenize as ["1","cand","isus","hristos","m","a","mantuit"],
    // and those single chars then polluted both the FTS query (prefix
    // expansions like "m"*) and the title-order scoring. Only meaningful
    // tokens should remain.
    expect(
      extractSearchTerms('1. Cand Isus Hristos m-a mantuit'),
    ).toEqual(['cand', 'isus', 'hristos', 'mantuit'])
  })

  test('returns empty for input that boils down to single chars only', () => {
    // Calling code in buildSearchQuery already short-circuits on empty
    // term lists; this just pins the behaviour.
    expect(extractSearchTerms('a o')).toEqual([])
    expect(extractSearchTerms('1 2 3')).toEqual([])
  })
})

describe('getValidTerms', () => {
  test('keeps standard word terms', () => {
    const { validTerms } = getValidTerms(['isus', 'noi', 'te', 'asteptam'])
    expect(validTerms).toEqual(['isus', 'noi', 'te', 'asteptam'])
  })

  test('filters out terms with punctuation', () => {
    // After fix, this case should not occur since extractSearchTerms handles punctuation
    // But getValidTerms should still handle it gracefully
    const { validTerms } = getValidTerms(['isus,isus', 'noi'])
    expect(validTerms).toEqual(['noi'])
  })
})

describe('normalizeForIndex', () => {
  test('replaces commas with spaces', () => {
    // Bug: indexed content kept commas, breaking phrase matching in scoring
    const normalized = normalizeForIndex('Isus,Isus noi te aşteptăm')
    expect(normalized).not.toContain(',')
    expect(normalized).toContain('Isus Isus')
  })

  test('replaces hyphens with spaces', () => {
    const normalized = normalizeForIndex('Te-aşteptăm')
    expect(normalized).not.toContain('-')
  })

  test('replaces other punctuation with spaces', () => {
    const normalized = normalizeForIndex('cuvânt.alt;cuvânt')
    expect(normalized).not.toContain('.')
    expect(normalized).not.toContain(';')
  })

  test('drops single-character tokens so title phrase matching survives "m-a"', () => {
    // Regression: title "Cand Isus Hristos m-a mantuit" used to tokenize as
    // "cand isus hristos m a mantuit". A user query for the same title then
    // could never see the exact phrase in the normalized index because of
    // the stray "m" and "a" tokens between "hristos" and "mantuit".
    const normalized = normalizeForIndex('Cand Isus Hristos m-a mantuit')
    expect(normalized).toBe('Cand Isus Hristos mantuit')
    expect(normalized.toLowerCase()).toContain('cand isus hristos mantuit')
  })
})

describe('buildSearchQuery', () => {
  test('reported regression: "1. Cand Isus Hristos m-a mantuit" emits a title-restricted phrase tier so the song can outrank synonym noise', () => {
    // The TODO.md "Căutarea nu găsește …" bug. After normalizeForIndex and
    // extractSearchTerms drop single chars, the joined phrase becomes
    // "cand isus hristos mantuit" — and that exact phrase needs to appear
    // restricted to the `title` column so BM25 lifts the matching song
    // even when synonym expansion (hristos → cristos) widens the broad OR
    // tier to 20k+ candidates.
    const q = buildSearchQuery('1. Cand Isus Hristos m-a mantuit')
    expect(q).toContain('title:"cand isus hristos mantuit"')
    // Other tiers still present for fuzzy / content matches
    expect(q).toContain('NEAR(')
    expect(q).toContain('"cand"*')
  })

  test('synonym-expanded query keeps the title-restricted clause on the original terms only', () => {
    // Caller appends a synonym (e.g. cristos) to queryText, but passes the
    // pre-expansion terms via the originalTerms arg so the title clause
    // doesn't require the synonym word to appear in the title.
    const q = buildSearchQuery('cand isus hristos mantuit cristos', [
      'cand',
      'isus',
      'hristos',
      'mantuit',
    ])
    expect(q).toContain('title:"cand isus hristos mantuit"')
    expect(q).not.toContain('title:"cand isus hristos mantuit cristos"')
    // Broad / phrase tiers still use the full expanded set
    expect(q).toContain('"cristos"*')
  })

  test('omits title-restricted clause when only one meaningful term', () => {
    const q = buildSearchQuery('Isus')
    // single-term path returns just a prefix match, no need for title clause
    expect(q).toBe('"isus"*')
  })
})

describe('scoring - score bounds', () => {
  test('title score never exceeds 100', () => {
    const score = calculateTitleScoreNormalized(
      'cat de bine ma simt cu alesii domnului',
      extractSearchTerms('Cât de bine mă simt cu aleşii Domnului'),
    )
    expect(score).toBeLessThanOrEqual(100)
  })

  test('content score never exceeds 100', () => {
    const score = calculateBestPhraseScoreNormalized(
      'cat de bine ma simt cu alesii domnului in fiecare zi',
      extractSearchTerms('Cât de bine mă simt cu aleşii Domnului'),
    )
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('normalizeForIndex - HTML tag stripping', () => {
  test('strips HTML tags from content before normalization', () => {
    const normalized = normalizeForIndex(
      '<p>Sa ne speli de-orice pacat;</p><p>A noastra nelegiuire</p>',
    )
    // Should not contain "p" tokens from <p> tags
    expect(normalized).not.toMatch(/\bp\b/)
    expect(normalized).toContain('Sa ne speli de orice pacat')
    // "A" (Romanian article) is dropped as a single-char noise token;
    // the rest of the second clause is preserved.
    expect(normalized).toContain('noastra nelegiuire')
  })
})

describe('scoring - content-only match should score high', () => {
  test('exact phrase in content scores 100 even when title has no match', () => {
    // Song 20: searching slide lyrics "Sa ne speli de-orice pacat;"
    // should find "020 - O Isuse jertfa sfanta" as top result
    const normalizedContent = normalizeForIndex(
      '<p>Ai venit cu-a Ta iubire</p><p>Sa ne speli de-orice pacat;</p>',
    )
    const terms = extractSearchTerms('Sa ne speli de-orice pacat;')
    const contentScore = calculateBestPhraseScoreNormalized(
      normalizedContent,
      terms,
    )
    expect(contentScore).toBe(100)

    // Title has no matching terms
    const titleScore = calculateTitleScoreNormalized(
      normalizeForIndex('020 - O Isuse jertfa sfanta').toLowerCase(),
      terms,
    )
    expect(titleScore).toBe(0)

    // Final combined score should still be high (not penalized by title miss)
    const termScore = Math.max(titleScore, contentScore) + titleScore * 0.15
    expect(termScore).toBeGreaterThanOrEqual(100)
  })
})

describe('scoring - exact phrase matching across punctuation', () => {
  test('content with comma-separated words scores high for matching phrase', () => {
    // Simulates song 749's indexed content (after normalizeForIndex fix)
    const normalizedContent = normalizeForIndex(
      'Isus,Isus noi te aşteptăm Vino Doamne mai degrabă',
    )
    const queryTerms = extractSearchTerms('Isus,Isus noi te aşteptăm')

    const score = calculateBestPhraseScoreNormalized(
      normalizedContent,
      queryTerms,
    )
    // Should be 100 since exact phrase is present
    expect(score).toBe(100)
  })

  test('title "Isus Isus noi Te-asteptam" scores high for query "Isus,Isus noi te aşteptăm"', () => {
    const normalizedTitle = normalizeForIndex('Isus Isus noi Te-asteptam')
    const queryTerms = extractSearchTerms('Isus,Isus noi te aşteptăm')

    const score = calculateTitleScoreNormalized(normalizedTitle, queryTerms)
    // Should be 95+ since exact phrase is in title
    expect(score).toBeGreaterThanOrEqual(95)
  })

  test('title "Noi Te aşteptăm cu dor" scores lower than full-phrase match', () => {
    const fullMatchTitle = normalizeForIndex('Isus Isus noi Te-asteptam')
    const partialMatchTitle = normalizeForIndex('Noi Te aşteptăm cu dor')
    const queryTerms = extractSearchTerms('Isus,Isus noi te aşteptăm')

    const fullScore = calculateTitleScoreNormalized(fullMatchTitle, queryTerms)
    const partialScore = calculateTitleScoreNormalized(
      partialMatchTitle,
      queryTerms,
    )

    // Full match should score higher than partial match
    expect(fullScore).toBeGreaterThan(partialScore)
  })
})

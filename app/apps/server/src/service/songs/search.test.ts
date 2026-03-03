import {
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
    expect(normalized).toContain('A noastra nelegiuire')
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

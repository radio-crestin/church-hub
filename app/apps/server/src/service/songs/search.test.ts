import {
  buildSearchQuery,
  calculateBestPhraseScoreNormalized,
  calculateTitleScoreNormalized,
  createFuzzyHighlightedSnippet,
  extractSearchTerms,
  getValidTerms,
  highlightWithDiacritics,
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

  test('strips leading hymn-number-style prefix but keeps clitic single chars', () => {
    // User-reported regression: "1. Cand Isus Hristos m-a mantuit" must
    // still match the song titled "Cand Isus Hristos m-a mantuit". The
    // leading "1." is a hymn number that the user remembers — drop it
    // from the query. The "m" and "a" from "m-a", however, are clitic
    // tokens that need to survive so the title phrase still matches.
    expect(
      extractSearchTerms('1. Cand Isus Hristos m-a mantuit'),
    ).toEqual(['cand', 'isus', 'hristos', 'm', 'a', 'mantuit'])
  })

  test('strips hymn-number prefixes with various separators', () => {
    expect(extractSearchTerms('265. Cantarea')).toEqual(['cantarea'])
    expect(extractSearchTerms('34 - Cantarea')).toEqual(['cantarea'])
    expect(extractSearchTerms('  001  Cantarea')).toEqual(['cantarea'])
  })

  test('does NOT strip internal numbers', () => {
    expect(extractSearchTerms('Psalmul 23 si Isus')).toContain('23')
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

  test('keeps the clitic single-letter tokens so "m-a" becomes "m a" in the index', () => {
    // Single-character tokens stay in the index alongside meaningful
    // words. With the matching query (after extractSearchTerms strips
    // its hymn-number prefix) preserving those same tokens, FTS phrase
    // matching can land directly on the title.
    const normalized = normalizeForIndex('Cand Isus Hristos m-a mantuit')
    expect(normalized).toBe('Cand Isus Hristos m a mantuit')
  })
})

describe('buildSearchQuery', () => {
  test('reported regression: "1. Cand Isus Hristos m-a mantuit" emits a title-restricted phrase with the clitic tokens preserved', () => {
    // The TODO.md "Căutarea nu găsește …" bug. extractSearchTerms strips
    // the leading hymn-number prefix ("1.") but keeps the clitic tokens
    // (m / a from "m-a"), so the title clause exactly matches the indexed
    // title "cand isus hristos m a mantuit".
    const q = buildSearchQuery('1. Cand Isus Hristos m-a mantuit')
    expect(q).toContain('title:"cand isus hristos m a mantuit"')
    // Single-character clitic tokens stay in the phrase + NEAR tiers …
    expect(q).toContain('("cand isus hristos m a mantuit")')
    expect(q).toContain('NEAR(')
    // … but are excluded from the prefix-broad OR (no "m"* / "a"*).
    expect(q).toContain('"cand"*')
    expect(q).not.toMatch(/"m"\*/)
    expect(q).not.toMatch(/"a"\*/)
  })

  test('synonym-expanded query keeps the title clause on the original terms only', () => {
    // Caller appends a synonym (e.g. cristos) to queryText, but passes the
    // pre-expansion terms via the originalTerms arg so the title clause
    // doesn't require the synonym word to appear in the title.
    const q = buildSearchQuery('cand isus hristos m a mantuit cristos', [
      'cand',
      'isus',
      'hristos',
      'm',
      'a',
      'mantuit',
    ])
    expect(q).toContain('title:"cand isus hristos m a mantuit"')
    expect(q).not.toContain('title:"cand isus hristos m a mantuit cristos"')
    // Broad-OR tier still uses the expanded set (sans single chars)
    expect(q).toContain('"cristos"*')
  })

  test('omits title-restricted clause when only one meaningful term', () => {
    const q = buildSearchQuery('Isus')
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
    // The Romanian article "A" survives — single-char tokens are kept in
    // the index (they carry phrase signal for clitic contractions).
    expect(normalized).toContain('A noastra nelegiuire')
  })
})

describe('highlightWithDiacritics - literal-substring path (rawQuery)', () => {
  test('marks exactly the typed phrase as the user incrementally types', () => {
    // The user's mental model: yellow highlight = literal substring of
    // what I typed. Title and content snippets must agree on this.
    const title = 'Cand Isus Hristos m-a mantuit'
    // …Cand Isus Hristos m
    expect(highlightWithDiacritics(title, [], 'Cand Isus Hristos m')).toBe(
      '<mark>Cand Isus Hristos m</mark>-a mantuit',
    )
    // …Cand Isus Hristos m-
    expect(highlightWithDiacritics(title, [], 'Cand Isus Hristos m-')).toBe(
      '<mark>Cand Isus Hristos m-</mark>a mantuit',
    )
    // …Cand Isus Hristos m-a
    expect(highlightWithDiacritics(title, [], 'Cand Isus Hristos m-a')).toBe(
      '<mark>Cand Isus Hristos m-a</mark> mantuit',
    )
    // …Cand Isus Hristos m-a mantuit (full phrase)
    expect(
      highlightWithDiacritics(title, [], 'Cand Isus Hristos m-a mantuit'),
    ).toBe('<mark>Cand Isus Hristos m-a mantuit</mark>')
  })

  test('literal substring is diacritic-insensitive and strips the leading hymn-number prefix', () => {
    const title = 'Când Isus Hristos m-a mântuit'
    // Stripped diacritics in the query still pick up the title diacritics
    expect(highlightWithDiacritics(title, [], 'cand isus hristos m-a')).toBe(
      '<mark>Când Isus Hristos m-a</mark> mântuit',
    )
    // Leading hymn-number prefix is dropped for the highlight too
    expect(
      highlightWithDiacritics(title, [], '1. cand isus hristos m-a'),
    ).toBe('<mark>Când Isus Hristos m-a</mark> mântuit')
  })

  test('"m-am departat de Mântuitorul" marks exactly that phrase', () => {
    const title = 'M-am depărtat de Mântuitorul ce m-a salvat'
    const out = highlightWithDiacritics(title, [], 'm-am departat de mantuitorul')
    // M- prefix is included; trailing "ce m-a salvat" is not touched.
    expect(out).toBe('<mark>M-am depărtat de Mântuitorul</mark> ce m-a salvat')
  })
})

describe('highlightWithDiacritics - per-term fallback', () => {
  test('falls back to per-term when the typed phrase is not a literal substring', () => {
    // "isus mantuit" is not contiguous in the title, so per-term marks
    // each term independently (no clitic gap to bridge across "hristos m-a").
    const out = highlightWithDiacritics(
      'Cand Isus Hristos m-a mantuit',
      ['isus', 'mantuit'],
      'isus mantuit',
    )
    expect(out).toContain('<mark>Isus</mark>')
    expect(out).toContain('<mark>mantuit</mark>')
    expect(out).not.toContain('<mark>Isus Hristos m-a mantuit</mark>')
  })

  test('marks individual words and merges adjacent ones (whitespace + clitic gap)', () => {
    // Per-term path with no rawQuery: ["isus","mantuit"] in adjacent
    // positions get merged if the gap is whitespace-only or a clitic.
    const out = highlightWithDiacritics('Isus mantuit', ['isus', 'mantuit'])
    expect(out).toBe('<mark>Isus mantuit</mark>')
  })

  test('does not nest <mark> tags when a shorter term overlaps a longer one', () => {
    // Pre-existing artefact regression guard.
    const out = highlightWithDiacritics(
      'M-am depărtat de Mântuitorul',
      ['am', 'departat', 'de', 'mantuitorul'],
    )
    expect(out).not.toMatch(/<mark><mark>/)
    expect(out).not.toMatch(/<\/mark><\/mark>/)
  })

  test('per-term path with single-char clitic ("am") does not extend into "M-"', () => {
    // The aggressive backward extension was removed — without a
    // surrounding rawQuery to anchor the literal substring, "am" alone
    // marks only "am", not "M-am".
    const out = highlightWithDiacritics('M-am departat', ['am', 'departat'])
    expect(out).toBe('M-<mark>am departat</mark>')
  })
})

describe('createFuzzyHighlightedSnippet - literal-substring path matches the title', () => {
  test('marks exactly what the user typed in the snippet (title + snippet stay in sync)', () => {
    const content =
      'Cantam: Cand Isus Hristos m-a mantuit, viata mea s-a schimbat.'
    // User typed "Cand Isus Hristos m" — both highlighters should mark
    // the same literal slice.
    const snippet = createFuzzyHighlightedSnippet(
      content,
      ['cand', 'isus', 'hristos', 'm'],
      150,
      'Cand Isus Hristos m',
    )
    expect(snippet).toContain('<mark>Cand Isus Hristos m</mark>')
    // The trailing "-a mantuit" must NOT be inside the mark — exact literal
    expect(snippet).not.toContain('<mark>Cand Isus Hristos m-')
  })

  test('one more character widens the mark by exactly one character', () => {
    const content = 'Lyrics: Cand Isus Hristos m-a mantuit pe noi.'
    const snippet = createFuzzyHighlightedSnippet(
      content,
      ['cand', 'isus', 'hristos', 'm'],
      150,
      'Cand Isus Hristos m-',
    )
    expect(snippet).toContain('<mark>Cand Isus Hristos m-</mark>')
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

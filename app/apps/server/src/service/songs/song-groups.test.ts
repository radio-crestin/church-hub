import {
  buildLyricsRecallMatchQuery,
  scoreVersionLikelihood,
} from './song-groups'
import Database from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'

/**
 * Helper mirroring `tokenize` in song-groups.ts (lowercase + diacritic fold +
 * split on whitespace) so the tests can feed realistic strings without
 * importing the private tokenizer.
 */
function toks(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

describe('buildLyricsRecallMatchQuery', () => {
  test('restricts the OR group to the content (lyrics) column', () => {
    const q = buildLyricsRecallMatchQuery(toks('slava tie iertarea pace'))
    expect(q.startsWith('{content} : (')).toBe(true)
    expect(q).toContain(' OR ')
    expect(q).toContain('"iertarea"')
  })

  test('returns empty string when the song has no distinctive lyric words', () => {
    // All Romanian stopwords / single chars → nothing distinctive to recall on.
    expect(buildLyricsRecallMatchQuery(toks('si de la cu pe o a'))).toBe('')
    expect(buildLyricsRecallMatchQuery([])).toBe('')
  })

  test('caps the number of terms so a long hymn cannot blow past FTS limits', () => {
    const manyWords = Array.from({ length: 200 }, (_, i) => `cuvant${i}`).join(
      ' ',
    )
    const q = buildLyricsRecallMatchQuery(toks(manyWords))
    const termCount = (q.match(/"/g)?.length ?? 0) / 2
    expect(termCount).toBe(60)
  })

  test('orders terms longest-first (rarer words are more selective)', () => {
    const q = buildLyricsRecallMatchQuery(toks('a izvorul cant mantuire'))
    const order = [...q.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    // "a" is dropped (single char); the rest are sorted by descending length.
    expect(order).toEqual(['mantuire', 'izvorul', 'cant'])
  })

  test('the generated query parses and selects only lyrics-column matches', () => {
    // Proves the {content} : (...) syntax against a real FTS5 table — a
    // category-name-only hit must NOT be recalled.
    const db = new Database(':memory:')
    db.run(`CREATE VIRTUAL TABLE songs_fts USING fts5(
      song_id UNINDEXED, title, category_name, content,
      tokenize='unicode61 remove_diacritics 2'
    );`)
    db.run(`INSERT INTO songs_fts(song_id,title,category_name,content) VALUES
      (10,'Refren al iertarii','Colinde','slava tie cant dor multumire cer drag iertarea pace'),
      (11,'Altceva','pace mare','cuvinte fara nicio legatura aici'),
      (12,'Diferit','Generale','alte cuvinte total straine de context');`)

    const q = buildLyricsRecallMatchQuery(
      toks('slava tie cant multumire iertarea pace'),
    )
    const rows = db
      .query<{ song_id: number }, [string]>(
        'SELECT song_id FROM songs_fts WHERE songs_fts MATCH ? ORDER BY rank',
      )
      .all(q)
    const ids = rows.map((r) => r.song_id)
    expect(ids).toContain(10) // lyrics overlap → recalled
    expect(ids).not.toContain(11) // "pace" only in category_name → excluded
    expect(ids).not.toContain(12) // unrelated lyrics → excluded
  })
})

describe('scoreVersionLikelihood — verse (lyrics) matching', () => {
  test('disjoint titles + identical verses → lyrics match at full score', () => {
    const lyrics = 'slava tie cant cu dor si multumire cer iertarea ta si pace'
    const { score, reason } = scoreVersionLikelihood(
      toks('Cantarea izvor de pace'),
      toks(lyrics),
      'Refren al iertarii', // no distinctive word shared with the subject title
      lyrics,
    )
    expect(reason).toBe('lyrics')
    expect(score).toBeGreaterThanOrEqual(0.7)
  })

  test('disjoint titles + verses overlapping under 70% → rejected', () => {
    const { score } = scoreVersionLikelihood(
      toks('Prima cantare'),
      toks('alfa beta gama delta epsilon'),
      'Total alta', // disjoint title
      'alfa zeta eta theta iota', // shares only "alfa" → ~0.11 Jaccard
    )
    expect(score).toBe(0)
  })

  test('two trivially short songs sharing one word do NOT match', () => {
    // The degenerate guard: both sides have < 4 distinct content words.
    const { score } = scoreVersionLikelihood(
      toks('Prima'),
      toks('aleluia'),
      'Ultima', // disjoint title → forces the pure-lyrics path
      'aleluia', // identical but trivial → Jaccard 1.0, guard kills it
    )
    expect(score).toBe(0)
  })

  test('shared distinctive title word still scores via the blended path', () => {
    const lyrics = 'isus hristos a inviat din morti biruind moartea'
    const { score, reason } = scoreVersionLikelihood(
      toks('Iisus Hristos a inviat'),
      toks(lyrics),
      'Iisus Hristos a inviat azi', // shares "hristos"/"inviat"
      lyrics,
    )
    expect(score).toBeGreaterThan(0)
    expect(['title', 'lyrics', 'mixed']).toContain(reason)
  })
})

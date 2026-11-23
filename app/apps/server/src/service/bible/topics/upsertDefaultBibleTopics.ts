import { hashBibleTopic } from './hashBibleTopic'
import type { BibleTopicFixture, BibleTopicRecord } from './types'
import type { Database } from 'bun:sqlite'

export interface DefaultBibleTopicsResult {
  added: number
  updated: number
  removed: number
}

/**
 * Brings the bundled topics into the database: adds the new ones, updates
 * the ones a new version changed and removes the ones it dropped, but never
 * touches a topic the user changed (its content no longer matches the hash
 * of what was last bundled) or made (no hash). Writes nothing when nothing
 * changed, so it runs on every start.
 */
export function upsertDefaultBibleTopics(
  db: Database,
  fixtures: BibleTopicFixture[],
): DefaultBibleTopicsResult {
  const result = { added: 0, updated: 0, removed: 0 }
  const existing = new Map(
    db
      .query<BibleTopicRecord, []>('SELECT * FROM bible_topics')
      .all()
      .map((row) => [row.key, row]),
  )
  const isUnchangedDefault = (row: BibleTopicRecord) =>
    row.fixture_hash !== null &&
    row.fixture_hash ===
      hashBibleTopic(row.title_en, row.title_ro, row.verse_references)

  const insert = db.prepare(
    `INSERT INTO bible_topics
      (key, title_en, title_ro, verse_references, fixture_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  )
  const update = db.prepare(
    `UPDATE bible_topics SET title_en = ?, title_ro = ?, verse_references = ?,
      fixture_hash = ?, updated_at = unixepoch() WHERE id = ?`,
  )
  const remove = db.prepare('DELETE FROM bible_topics WHERE id = ?')

  db.transaction(() => {
    for (const fixture of fixtures) {
      const references = JSON.stringify(fixture.references)
      const hash = hashBibleTopic(fixture.titleEn, fixture.titleRo, references)
      const row = existing.get(fixture.key)
      if (!row) {
        insert.run(
          fixture.key,
          fixture.titleEn,
          fixture.titleRo,
          references,
          hash,
        )
        result.added++
      } else if (row.fixture_hash !== hash && isUnchangedDefault(row)) {
        update.run(fixture.titleEn, fixture.titleRo, references, hash, row.id)
        result.updated++
      }
    }
    const bundledKeys = new Set(fixtures.map((fixture) => fixture.key))
    for (const row of existing.values()) {
      if (!bundledKeys.has(row.key) && isUnchangedDefault(row)) {
        remove.run(row.id)
        result.removed++
      }
    }
  })()
  return result
}

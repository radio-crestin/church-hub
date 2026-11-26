import type { Database } from 'bun:sqlite'
import {
  type BibleTopicFixture,
  upsertDefaultBibleTopics,
} from '../../service/bible/topics'
import defaultBibleTopicsFile from '../fixtures/default-bible-topics.json' with {
  type: 'file',
}
import { readFixtureFile } from '../fixtures/readFixtureFile'

/**
 * Seeds the bundled Bible topics (OpenBible.info, CC BY 4.0) on the first
 * start and brings a new version's changes in on upgrade, leaving the topics
 * the user changed alone. To re-sync them from OpenBible.info:
 * bun scripts/bible-topics/import-openbible-topics.ts
 */
export function seedBibleTopics(db: Database): void {
  const fixtures = readFixtureFile<BibleTopicFixture[]>(defaultBibleTopicsFile)
  const { added, updated, removed } = upsertDefaultBibleTopics(db, fixtures)
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(
    `[seed-bible-topics:info] ${added} added, ${updated} updated, ${removed} removed`,
  )
}

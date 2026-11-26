import type { Database } from 'bun:sqlite'

/**
 * Slide templates for Bible topics (T-902):
 * - `bible_topics.template_id`: the one the operator chose for a topic;
 *   NULL: its fitting default (see getFittingTopicTemplateId).
 * - `bible_topic_passage_templates`: a passage drawn with its own template
 *   instead of the topic's (a passage is its reference: book code, chapter,
 *   verse range). Kept apart from the topic's references, whose hash tells a
 *   bundled topic the user never changed.
 * Both go with their template; the passages go with their topic. Idempotent.
 */
export function addBibleTopicTemplates(db: Database): void {
  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(bible_topics)')
    .all()
  if (!columns.some((column) => column.name === 'template_id')) {
    db.run(
      'ALTER TABLE bible_topics ADD COLUMN template_id INTEGER REFERENCES slide_templates(id) ON DELETE SET NULL',
    )
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS bible_topic_passage_templates (
      topic_id INTEGER NOT NULL REFERENCES bible_topics(id) ON DELETE CASCADE,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      start_verse INTEGER NOT NULL,
      end_verse INTEGER NOT NULL,
      template_id INTEGER NOT NULL REFERENCES slide_templates(id) ON DELETE CASCADE,
      PRIMARY KEY (topic_id, book, chapter, start_verse, end_verse)
    )
  `)
}

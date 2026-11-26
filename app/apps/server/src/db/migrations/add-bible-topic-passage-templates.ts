import type { Database } from 'bun:sqlite'

/**
 * A passage of a Bible topic drawn with its own slide template instead of
 * the topic's (a passage is its reference: book code, chapter, verse range).
 * Kept apart from the topic's references, whose hash tells a bundled topic
 * the user never changed. Goes with its topic and with its template.
 * Idempotent.
 */
export function addBibleTopicPassageTemplates(db: Database): void {
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

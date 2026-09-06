-- Person name becomes optional on "Versete Biblice" entries.
--
-- The two Bible item types in a program (bible_passage and the versete_tineri
-- slide) are merged into one, and the surviving shape is versete_tineri. A
-- passage added straight from the Bible has no person attached to it, so
-- person_name can no longer be required.
--
-- SQLite cannot relax a NOT NULL in place, so the table is rebuilt. The column
-- stays NOT NULL with a '' default (same trick as schedules.uuid) rather than
-- becoming nullable: every read site keeps a plain string and no ?? spreads
-- through the app.
--
-- The data conversion of existing bible_passage items lives in
-- src/db/migrations/merge-bible-passages-into-versete-tineri.ts, which can log
-- the rows it cannot convert instead of silently mangling them.
--
-- Rebuilding the table drops its sync change-tracking triggers; addSync runs
-- last on every boot and recreates them (src/db/migrations/add-sync.ts).
CREATE TABLE IF NOT EXISTS schedule_versete_tineri_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL DEFAULT '',
  translation_id INTEGER NOT NULL,
  book_code TEXT NOT NULL,
  book_name TEXT NOT NULL,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  start_chapter INTEGER NOT NULL,
  start_verse INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL,
  end_verse INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO schedule_versete_tineri_entries_new (
  id, schedule_item_id, person_name, translation_id, book_code, book_name,
  reference, text, start_chapter, start_verse, end_chapter, end_verse,
  sort_order, created_at
)
SELECT
  id, schedule_item_id, person_name, translation_id, book_code, book_name,
  reference, text, start_chapter, start_verse, end_chapter, end_verse,
  sort_order, created_at
FROM schedule_versete_tineri_entries;
--> statement-breakpoint
DROP TABLE schedule_versete_tineri_entries;
--> statement-breakpoint
ALTER TABLE schedule_versete_tineri_entries_new RENAME TO schedule_versete_tineri_entries;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_versete_tineri_entries_item_id ON schedule_versete_tineri_entries(schedule_item_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_versete_tineri_entries_sort_order ON schedule_versete_tineri_entries(sort_order);

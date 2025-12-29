-- Add bible_passage support to schedule_items table
ALTER TABLE schedule_items ADD COLUMN bible_passage_reference TEXT;
--> statement-breakpoint
ALTER TABLE schedule_items ADD COLUMN bible_passage_translation TEXT;
--> statement-breakpoint

-- Create schedule_bible_passage_verses table for nested verses in bible_passage items
CREATE TABLE IF NOT EXISTS schedule_bible_passage_verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
  verse_id INTEGER NOT NULL REFERENCES bible_verses(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_bible_passage_verses_item_id ON schedule_bible_passage_verses(schedule_item_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_bible_passage_verses_sort_order ON schedule_bible_passage_verses(sort_order);
--> statement-breakpoint

-- Create schedule_versete_tineri_entries table for nested entries in versete_tineri slides
CREATE TABLE IF NOT EXISTS schedule_versete_tineri_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_schedule_versete_tineri_entries_item_id ON schedule_versete_tineri_entries(schedule_item_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_versete_tineri_entries_sort_order ON schedule_versete_tineri_entries(sort_order);

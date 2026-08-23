CREATE TABLE IF NOT EXISTS `bible_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`verse_id` integer NOT NULL,
	`reference` text NOT NULL,
	`text` text NOT NULL,
	`translation_abbreviation` text NOT NULL,
	`book_name` text NOT NULL,
	`book_code` text NOT NULL,
	`translation_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bible_bookmarks_verse_id` ON `bible_bookmarks` (`verse_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bible_bookmarks_sort_order` ON `bible_bookmarks` (`sort_order`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bible_bookmarks_created_at` ON `bible_bookmarks` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bible_bookmark_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bible_bookmark_notes_sort_order` ON `bible_bookmark_notes` (`sort_order`);

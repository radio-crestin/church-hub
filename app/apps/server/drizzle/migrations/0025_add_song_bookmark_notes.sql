CREATE TABLE IF NOT EXISTS `song_bookmark_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_song_bookmark_notes_sort_order` ON `song_bookmark_notes` (`sort_order`);

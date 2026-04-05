CREATE TABLE IF NOT EXISTS `song_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`song_id` integer NOT NULL REFERENCES `songs`(`id`) ON DELETE cascade,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_song_bookmarks_song_id` ON `song_bookmarks` (`song_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_song_bookmarks_sort_order` ON `song_bookmarks` (`sort_order`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_song_bookmarks_created_at` ON `song_bookmarks` (`created_at`);

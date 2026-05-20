CREATE TABLE IF NOT EXISTS `song_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `song_tags_name_unique` ON `song_tags` (`name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_song_tags_sort_order` ON `song_tags` (`sort_order`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `song_tag_assignments` (
	`song_id` integer NOT NULL REFERENCES `songs`(`id`) ON DELETE cascade,
	`tag_id` integer NOT NULL REFERENCES `song_tags`(`id`) ON DELETE cascade,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY (`song_id`, `tag_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_song_tag_assignments_tag_id` ON `song_tag_assignments` (`tag_id`);

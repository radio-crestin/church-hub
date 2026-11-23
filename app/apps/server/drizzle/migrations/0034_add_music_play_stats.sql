-- How often and when each track was last played, for the Music page's columns and queue orders
ALTER TABLE `music_files` ADD `play_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `music_files` ADD `last_played_at` integer;
--> statement-breakpoint
CREATE INDEX `idx_music_files_last_played_at` ON `music_files` (`last_played_at`);

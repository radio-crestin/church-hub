-- Add music_now_playing table for current playback queue
CREATE TABLE `music_now_playing` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `music_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_music_now_playing_sort_order` ON `music_now_playing` (`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_music_now_playing_file_id` ON `music_now_playing` (`file_id`);

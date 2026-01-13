-- Add song_search_history table for saving AI search results
CREATE TABLE `song_search_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`url_path` text NOT NULL,
	`search_type` text DEFAULT 'regular' NOT NULL,
	`category_ids` text,
	`ai_results` text,
	`result_count` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_song_search_history_created_at` ON `song_search_history` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_song_search_history_search_type` ON `song_search_history` (`search_type`);

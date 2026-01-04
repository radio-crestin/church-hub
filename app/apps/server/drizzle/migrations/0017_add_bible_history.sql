CREATE TABLE `bible_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`verse_id` integer NOT NULL,
	`reference` text NOT NULL,
	`text` text NOT NULL,
	`translation_abbreviation` text NOT NULL,
	`book_name` text NOT NULL,
	`translation_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bible_history_created_at` ON `bible_history` (`created_at`);

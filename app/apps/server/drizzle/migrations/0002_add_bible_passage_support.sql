CREATE TABLE `bible_passage_verses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue_item_id` integer,
	`verse_id` integer NOT NULL,
	`reference` text NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`queue_item_id`) REFERENCES `presentation_queue`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verse_id`) REFERENCES `bible_verses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bible_passage_verses_queue_item_id` ON `bible_passage_verses` (`queue_item_id`);--> statement-breakpoint
CREATE INDEX `idx_bible_passage_verses_sort_order` ON `bible_passage_verses` (`sort_order`);--> statement-breakpoint
ALTER TABLE `presentation_queue` ADD `bible_passage_reference` text;--> statement-breakpoint
ALTER TABLE `presentation_queue` ADD `bible_passage_translation` text;--> statement-breakpoint
ALTER TABLE `presentation_state` ADD `current_bible_passage_verse_id` integer REFERENCES bible_passage_verses(id);
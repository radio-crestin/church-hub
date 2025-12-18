CREATE TABLE `versete_tineri_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue_item_id` integer NOT NULL,
	`person_name` text NOT NULL,
	`translation_id` integer NOT NULL,
	`book_code` text NOT NULL,
	`book_name` text NOT NULL,
	`reference` text NOT NULL,
	`text` text NOT NULL,
	`start_chapter` integer NOT NULL,
	`start_verse` integer NOT NULL,
	`end_chapter` integer NOT NULL,
	`end_verse` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`queue_item_id`) REFERENCES `presentation_queue`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_versete_tineri_entries_queue_item_id` ON `versete_tineri_entries` (`queue_item_id`);--> statement-breakpoint
CREATE INDEX `idx_versete_tineri_entries_sort_order` ON `versete_tineri_entries` (`sort_order`);--> statement-breakpoint
ALTER TABLE `presentation_state` ADD `current_versete_tineri_entry_id` integer REFERENCES versete_tineri_entries(id);

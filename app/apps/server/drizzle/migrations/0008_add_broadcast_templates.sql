CREATE TABLE `broadcast_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`privacy_status` text DEFAULT 'unlisted' NOT NULL,
	`stream_key_id` text,
	`playlist_id` text,
	`category` text,
	`used_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_broadcast_templates_used_at` ON `broadcast_templates` (`used_at`);

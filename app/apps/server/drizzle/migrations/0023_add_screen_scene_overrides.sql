CREATE TABLE IF NOT EXISTS `screen_scene_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`screen_id` integer NOT NULL REFERENCES `screens`(`id`) ON DELETE cascade,
	`obs_scene_name` text NOT NULL,
	`content_type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_screen_scene_overrides_unique` ON `screen_scene_overrides` (`screen_id`, `obs_scene_name`, `content_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_screen_scene_overrides_screen_id` ON `screen_scene_overrides` (`screen_id`);

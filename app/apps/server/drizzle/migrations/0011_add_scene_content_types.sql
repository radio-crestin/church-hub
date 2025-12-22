ALTER TABLE `obs_scenes` ADD COLUMN `content_types` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
CREATE TABLE `scene_automation_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`previous_scene_name` text,
	`current_auto_scene` text,
	`last_content_type` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `scene_automation_state` (`id`, `is_enabled`) VALUES (1, 1);

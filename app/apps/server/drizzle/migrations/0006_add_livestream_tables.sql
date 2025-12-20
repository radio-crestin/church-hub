CREATE TABLE `youtube_auth` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`channel_id` text,
	`channel_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `youtube_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_template` text DEFAULT 'Live' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`privacy_status` text DEFAULT 'unlisted' NOT NULL,
	`stream_key_id` text,
	`playlist_id` text,
	`start_scene_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `obs_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host` text DEFAULT '127.0.0.1' NOT NULL,
	`port` integer DEFAULT 4455 NOT NULL,
	`password` text DEFAULT '' NOT NULL,
	`auto_connect` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `obs_scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`obs_scene_name` text NOT NULL,
	`display_name` text NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obs_scenes_obs_scene_name_unique` ON `obs_scenes` (`obs_scene_name`);--> statement-breakpoint
CREATE INDEX `idx_obs_scenes_sort_order` ON `obs_scenes` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_obs_scenes_is_visible` ON `obs_scenes` (`is_visible`);--> statement-breakpoint
CREATE TABLE `broadcast_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`broadcast_id` text NOT NULL,
	`title` text NOT NULL,
	`scheduled_start_time` integer NOT NULL,
	`actual_start_time` integer,
	`end_time` integer,
	`url` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_broadcast_history_status` ON `broadcast_history` (`status`);

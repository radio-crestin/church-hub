CREATE TABLE `screens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'primary' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`open_mode` text DEFAULT 'browser' NOT NULL,
	`is_fullscreen` integer DEFAULT false NOT NULL,
	`width` integer DEFAULT 1920 NOT NULL,
	`height` integer DEFAULT 1080 NOT NULL,
	`global_settings` text DEFAULT '{}' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_screens_is_active` ON `screens` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_screens_type` ON `screens` (`type`);--> statement-breakpoint
CREATE INDEX `idx_screens_sort_order` ON `screens` (`sort_order`);--> statement-breakpoint
CREATE TABLE `screen_content_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`screen_id` integer NOT NULL,
	`content_type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_screen_content_configs_screen_id` ON `screen_content_configs` (`screen_id`);--> statement-breakpoint
CREATE INDEX `idx_screen_content_configs_content_type` ON `screen_content_configs` (`content_type`);--> statement-breakpoint
CREATE TABLE `screen_next_slide_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`screen_id` integer NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_screen_next_slide_configs_screen_id` ON `screen_next_slide_configs` (`screen_id`);

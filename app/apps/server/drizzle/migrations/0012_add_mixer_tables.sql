ALTER TABLE `obs_scenes` ADD COLUMN `mixer_channel_actions` text NOT NULL DEFAULT '{"mute":[],"unmute":[]}';
--> statement-breakpoint
CREATE TABLE `mixer_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host` text DEFAULT '192.168.0.50' NOT NULL,
	`port` integer DEFAULT 10024 NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`channel_count` integer DEFAULT 16 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mixer_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_number` integer NOT NULL,
	`label` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mixer_channels_channel_number_unique` ON `mixer_channels` (`channel_number`);
--> statement-breakpoint
CREATE INDEX `idx_mixer_channels_number` ON `mixer_channels` (`channel_number`);

ALTER TABLE `youtube_config` ADD COLUMN `selected_broadcast_id` text;
--> statement-breakpoint
ALTER TABLE `youtube_config` ADD COLUMN `broadcast_mode` text DEFAULT 'create' NOT NULL;

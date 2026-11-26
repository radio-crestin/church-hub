-- Secrets only the server uses (the signaling host keys), in a table no HTTP route reads
CREATE TABLE `server_secrets` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
-- The listener link earlier versions made stops now: the Live Translation card tells the user once
INSERT OR IGNORE INTO `app_settings` (`key`, `value`) SELECT 'live_translation_link_changed', 'true' FROM `app_settings` WHERE `key` = 'live_translation_stream_secret';
--> statement-breakpoint
-- Room secrets of earlier versions, replaced by host keys in server_secrets
DELETE FROM `app_settings` WHERE `key` IN ('live_translation_stream_secret', 'remote_access_secret', 'signaling_host_secret', 'live_translation_stream_host_key', 'remote_access_host_key');

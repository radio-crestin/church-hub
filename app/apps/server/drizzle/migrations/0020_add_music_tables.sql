-- Add music tables for audio file management and playlists
CREATE TABLE `music_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`is_recursive` integer DEFAULT true NOT NULL,
	`last_sync_at` integer,
	`file_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_folders_path_unique` ON `music_folders` (`path`);
--> statement-breakpoint
CREATE INDEX `idx_music_folders_path` ON `music_folders` (`path`);
--> statement-breakpoint
CREATE TABLE `music_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`folder_id` integer NOT NULL REFERENCES `music_folders`(`id`) ON DELETE CASCADE,
	`path` text NOT NULL,
	`filename` text NOT NULL,
	`title` text,
	`artist` text,
	`album` text,
	`genre` text,
	`year` integer,
	`track_number` integer,
	`duration` real,
	`format` text NOT NULL,
	`file_size` integer,
	`last_modified` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_files_path_unique` ON `music_files` (`path`);
--> statement-breakpoint
CREATE INDEX `idx_music_files_folder_id` ON `music_files` (`folder_id`);
--> statement-breakpoint
CREATE INDEX `idx_music_files_path` ON `music_files` (`path`);
--> statement-breakpoint
CREATE INDEX `idx_music_files_title` ON `music_files` (`title`);
--> statement-breakpoint
CREATE INDEX `idx_music_files_artist` ON `music_files` (`artist`);
--> statement-breakpoint
CREATE INDEX `idx_music_files_album` ON `music_files` (`album`);
--> statement-breakpoint
CREATE TABLE `music_playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`total_duration` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_music_playlists_name` ON `music_playlists` (`name`);
--> statement-breakpoint
CREATE TABLE `music_playlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL REFERENCES `music_playlists`(`id`) ON DELETE CASCADE,
	`file_id` integer NOT NULL REFERENCES `music_files`(`id`) ON DELETE CASCADE,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_music_playlist_items_playlist_sort` ON `music_playlist_items` (`playlist_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_music_playlist_items_file_id` ON `music_playlist_items` (`file_id`);

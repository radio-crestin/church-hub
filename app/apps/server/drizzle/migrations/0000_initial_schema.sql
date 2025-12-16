CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);--> statement-breakpoint
CREATE INDEX `idx_app_settings_key` ON `app_settings` (`key`);--> statement-breakpoint
CREATE TABLE `cache_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cache_metadata_key_unique` ON `cache_metadata` (`key`);--> statement-breakpoint
CREATE INDEX `idx_cache_metadata_key` ON `cache_metadata` (`key`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_key_unique` ON `user_preferences` (`key`);--> statement-breakpoint
CREATE INDEX `idx_user_preferences_key` ON `user_preferences` (`key`);--> statement-breakpoint
CREATE TABLE `app_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_token` text NOT NULL,
	`session_token_hash` text NOT NULL,
	`name` text DEFAULT 'Local Admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_sessions_session_token_unique` ON `app_sessions` (`session_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_sessions_session_token_hash_unique` ON `app_sessions` (`session_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_app_sessions_token_hash` ON `app_sessions` (`session_token_hash`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_role_permissions_role_id` ON `role_permissions` (`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `role_permission_unique` ON `role_permissions` (`role_id`,`permission`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE INDEX `idx_roles_name` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_permissions_user_id` ON `user_permissions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_permission_unique` ON `user_permissions` (`user_id`,`permission`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`token_hash` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`role_id` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_token_hash_unique` ON `users` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_users_token_hash` ON `users` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_users_is_active` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_users_role_id` ON `users` (`role_id`);--> statement-breakpoint
CREATE TABLE `bible_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`translation_id` integer NOT NULL,
	`book_code` text NOT NULL,
	`book_name` text NOT NULL,
	`book_order` integer NOT NULL,
	`chapter_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `bible_translations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bible_books_translation_id` ON `bible_books` (`translation_id`);--> statement-breakpoint
CREATE INDEX `idx_bible_books_order` ON `bible_books` (`translation_id`,`book_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `bible_books_translation_book` ON `bible_books` (`translation_id`,`book_code`);--> statement-breakpoint
CREATE TABLE `bible_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`abbreviation` text NOT NULL,
	`language` text NOT NULL,
	`source_filename` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bible_translations_abbreviation_unique` ON `bible_translations` (`abbreviation`);--> statement-breakpoint
CREATE INDEX `idx_bible_translations_abbreviation` ON `bible_translations` (`abbreviation`);--> statement-breakpoint
CREATE TABLE `bible_verses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`translation_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `bible_translations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `bible_books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bible_verses_lookup` ON `bible_verses` (`book_id`,`chapter`,`verse`);--> statement-breakpoint
CREATE INDEX `idx_bible_verses_translation` ON `bible_verses` (`translation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bible_verses_unique` ON `bible_verses` (`translation_id`,`book_id`,`chapter`,`verse`);--> statement-breakpoint
CREATE TABLE `displays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`open_mode` text DEFAULT 'browser' NOT NULL,
	`is_fullscreen` integer DEFAULT false NOT NULL,
	`theme` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_displays_is_active` ON `displays` (`is_active`);--> statement-breakpoint
CREATE TABLE `presentation_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_type` text NOT NULL,
	`song_id` integer,
	`slide_type` text,
	`slide_content` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_expanded` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_presentation_queue_sort_order` ON `presentation_queue` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_presentation_queue_song_id` ON `presentation_queue` (`song_id`);--> statement-breakpoint
CREATE TABLE `presentation_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`is_presenting` integer DEFAULT false NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`current_queue_item_id` integer,
	`current_song_slide_id` integer,
	`last_song_slide_id` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`current_queue_item_id`) REFERENCES `presentation_queue`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_song_slide_id`) REFERENCES `song_slides`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`last_song_slide_id`) REFERENCES `song_slides`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `schedule_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`song_id` integer,
	`slide_type` text,
	`slide_content` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_schedule_items_schedule_id` ON `schedule_items` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `idx_schedule_items_sort_order` ON `schedule_items` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_schedule_items_song_id` ON `schedule_items` (`song_id`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_schedules_title` ON `schedules` (`title`);--> statement-breakpoint
CREATE TABLE `song_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_categories_name_unique` ON `song_categories` (`name`);--> statement-breakpoint
CREATE INDEX `idx_song_categories_name` ON `song_categories` (`name`);--> statement-breakpoint
CREATE TABLE `song_slides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`song_id` integer NOT NULL,
	`content` text NOT NULL,
	`label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_song_slides_song_id` ON `song_slides` (`song_id`);--> statement-breakpoint
CREATE INDEX `idx_song_slides_sort_order` ON `song_slides` (`sort_order`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category_id` integer,
	`source_filename` text,
	`author` text,
	`copyright` text,
	`ccli` text,
	`key` text,
	`tempo` text,
	`time_signature` text,
	`theme` text,
	`alt_theme` text,
	`hymn_number` text,
	`key_line` text,
	`presentation_order` text,
	`presentation_count` integer DEFAULT 0 NOT NULL,
	`last_manual_edit` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `song_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_title_unique` ON `songs` (`title`);--> statement-breakpoint
CREATE INDEX `idx_songs_title` ON `songs` (`title`);--> statement-breakpoint
CREATE INDEX `idx_songs_category_id` ON `songs` (`category_id`);
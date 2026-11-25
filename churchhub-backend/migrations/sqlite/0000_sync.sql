CREATE TABLE `bucket_objects` (
	`church_id` text NOT NULL,
	`key` text NOT NULL,
	`kind` text NOT NULL,
	`seq` integer NOT NULL,
	PRIMARY KEY(`church_id`, `key`)
);
--> statement-breakpoint
CREATE INDEX `idx_bucket_objects_seq` ON `bucket_objects` (`church_id`,`kind`,`seq`);--> statement-breakpoint
CREATE TABLE `churches` (
	`id` text PRIMARY KEY NOT NULL,
	`path_secret` text NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`commit_nonce` text,
	`snapshot_seq` integer DEFAULT 0 NOT NULL,
	`snapshot_key` text,
	`owner_google_sub` text,
	`owner_email` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`church_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`is_server` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_token_hash_unique` ON `devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_devices_church` ON `devices` (`church_id`);--> statement-breakpoint
CREATE TABLE `entities` (
	`church_id` text NOT NULL,
	`type` text NOT NULL,
	`uuid` text NOT NULL,
	`version` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`content_hash` text,
	`created_by` text,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`church_id`, `type`, `uuid`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`church_id` text NOT NULL,
	`role_id` text NOT NULL,
	`permission` text NOT NULL,
	PRIMARY KEY(`church_id`, `role_id`, `permission`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`church_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`church_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`church_id` text NOT NULL,
	`user_id` text NOT NULL,
	`permission` text NOT NULL,
	PRIMARY KEY(`church_id`, `user_id`, `permission`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`church_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`role_id` text,
	`is_super_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`church_id`, `id`)
);

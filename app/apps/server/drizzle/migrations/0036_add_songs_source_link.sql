-- Where a song came from (a song source and its id there) and its lyrics fingerprint, for dedup and safe updates (T-176)
ALTER TABLE `songs` ADD `source_id` text;
--> statement-breakpoint
ALTER TABLE `songs` ADD `source_song_id` text;
--> statement-breakpoint
-- The song's content hash when the source last gave it its lyrics: equal to content_hash while nobody changed them here
ALTER TABLE `songs` ADD `source_hash` text;
--> statement-breakpoint
-- SHA-256 of the normalized lyrics (lyricsFingerprint); NULL until computed, and again whenever a slide changes
ALTER TABLE `songs` ADD `content_hash` text;
--> statement-breakpoint
CREATE INDEX `idx_songs_source_song` ON `songs` (`source_id`, `source_song_id`);
--> statement-breakpoint
CREATE INDEX `idx_songs_content_hash` ON `songs` (`content_hash`);
--> statement-breakpoint
CREATE TRIGGER `songs_content_hash_slide_ai` AFTER INSERT ON `song_slides` BEGIN UPDATE `songs` SET `content_hash` = NULL WHERE `id` = NEW.`song_id` AND `content_hash` IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER `songs_content_hash_slide_au` AFTER UPDATE OF `content`, `sort_order`, `song_id` ON `song_slides` BEGIN UPDATE `songs` SET `content_hash` = NULL WHERE `id` IN (NEW.`song_id`, OLD.`song_id`) AND `content_hash` IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER `songs_content_hash_slide_ad` AFTER DELETE ON `song_slides` BEGIN UPDATE `songs` SET `content_hash` = NULL WHERE `id` = OLD.`song_id` AND `content_hash` IS NOT NULL; END;
--> statement-breakpoint
-- "Share my songs": the church's songs published as a shared library through the sync service (T-176)
CREATE TABLE `song_library_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`name` text NOT NULL,
	`publisher` text NOT NULL,
	`category_ids` text,
	`listed` integer DEFAULT 0 NOT NULL,
	`manifest_url` text,
	`published_checksum` text,
	`published_shards` text,
	`song_count` integer DEFAULT 0 NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_library_shares_source_id_unique` ON `song_library_shares` (`source_id`);

ALTER TABLE `presentation_queue` ADD `bible_verse_id` integer REFERENCES bible_verses(id);--> statement-breakpoint
ALTER TABLE `presentation_queue` ADD `bible_reference` text;--> statement-breakpoint
ALTER TABLE `presentation_queue` ADD `bible_text` text;--> statement-breakpoint
ALTER TABLE `presentation_queue` ADD `bible_translation` text;--> statement-breakpoint
CREATE INDEX `idx_presentation_queue_bible_verse_id` ON `presentation_queue` (`bible_verse_id`);
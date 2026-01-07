-- Add obs_scene_name column to schedule_items table for scene type slides
ALTER TABLE `schedule_items` ADD COLUMN `obs_scene_name` TEXT;

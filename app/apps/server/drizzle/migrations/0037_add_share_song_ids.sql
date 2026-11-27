-- A share holds hand-picked songs as well as categories: a JSON array of song ids (T-177)
ALTER TABLE `song_library_shares` ADD `song_ids` text;

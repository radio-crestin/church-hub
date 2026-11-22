/**
 * Each song's title, category and lyrics, as the search index stores them.
 * The slides are read per song through their own index: a join on every
 * slide of the library cost ~1 s whatever the number of songs asked for.
 */
export const SONG_INDEX_ROWS_SQL = `SELECT s.id, s.title, s.alternate_titles,
       COALESCE(sc.name, '') AS category_name,
       COALESCE((SELECT GROUP_CONCAT(content, ' ')
                 FROM (SELECT content FROM song_slides
                       WHERE song_id = s.id ORDER BY sort_order)), '') AS content
FROM songs s
LEFT JOIN song_categories sc ON s.category_id = sc.id`

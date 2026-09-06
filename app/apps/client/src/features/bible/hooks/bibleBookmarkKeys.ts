/**
 * Query keys for the bookmark list.
 *
 * Kept in their own module so the bookmark and note hooks can each invalidate
 * the other's cache without importing each other in a cycle.
 */
export const BIBLE_BOOKMARKS_QUERY_KEY = ['bible-bookmarks']
export const BIBLE_BOOKMARK_NOTES_QUERY_KEY = ['bible-bookmark-notes']

/**
 * SQL condition that keeps only songs whose category is not hidden.
 * Uncategorized songs (NULL category) stay visible. Filtering in SQL, before
 * any LIMIT, keeps a large hidden category from using up the result slots.
 */
export function visibleCategoryCondition(categoryColumn: string): string {
  return `(${categoryColumn} IS NULL OR ${categoryColumn} NOT IN (SELECT id FROM song_categories WHERE is_hidden = 1))`
}

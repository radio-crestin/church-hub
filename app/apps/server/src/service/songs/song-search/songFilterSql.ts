import { visibleCategoryCondition } from '../visibleCategoryCondition'

/** The narrowing a song search can carry besides its text. */
export interface SongSearchFilters {
  presentedOnly?: boolean
  inSchedulesOnly?: boolean
  hasKeyLine?: boolean
  tagIds?: number[]
}

export interface SongFilterSql {
  /** Conditions on `s` (songs), each starting with AND. */
  sql: string
  params: number[]
}

/**
 * The SQL that keeps a search inside the chosen categories and filters.
 * Songs in a hidden category never surface.
 */
export function songFilterSql(
  categoryIds: number[] | undefined,
  filters: SongSearchFilters | undefined,
): SongFilterSql {
  const conditions = [visibleCategoryCondition('s.category_id')]
  const params: number[] = []
  if (categoryIds && categoryIds.length > 0) {
    conditions.push(`s.category_id IN (${placeholders(categoryIds)})`)
    params.push(...categoryIds)
  }
  if (filters?.tagIds && filters.tagIds.length > 0) {
    conditions.push(
      `s.id IN (SELECT song_id FROM song_tag_assignments WHERE tag_id IN (${placeholders(filters.tagIds)}))`,
    )
    params.push(...filters.tagIds)
  }
  if (filters?.presentedOnly) conditions.push('s.presentation_count > 0')
  if (filters?.inSchedulesOnly) {
    conditions.push(
      's.id IN (SELECT DISTINCT song_id FROM schedule_items WHERE song_id IS NOT NULL)',
    )
  }
  if (filters?.hasKeyLine) {
    conditions.push(`s.key_line IS NOT NULL AND s.key_line != ''`)
  }
  return {
    sql: conditions.map((condition) => `AND ${condition}`).join(' '),
    params,
  }
}

function placeholders(values: number[]): string {
  return values.map(() => '?').join(',')
}

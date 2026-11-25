import { asc, eq, isNull } from 'drizzle-orm'

import { toSlideTemplate } from './toSlideTemplate'
import type { SlideTemplate } from './types'
import { getDatabase } from '../../db'
import { slideTemplates } from '../../db/schema'

/**
 * Every shared template: the church's own first, then the bundled ones. A
 * presentation's own theme is reached through its presentation.
 */
export function getSlideTemplates(): SlideTemplate[] {
  return getDatabase()
    .select()
    .from(slideTemplates)
    .where(isNull(slideTemplates.scheduleId))
    .orderBy(asc(slideTemplates.sortOrder), asc(slideTemplates.id))
    .all()
    .map(toSlideTemplate)
    .sort((a, b) => Number(!!a.bundledKey) - Number(!!b.bundledKey))
}

export function getSlideTemplate(id: number): SlideTemplate | null {
  const record = getDatabase()
    .select()
    .from(slideTemplates)
    .where(eq(slideTemplates.id, id))
    .get()
  return record ? toSlideTemplate(record) : null
}

/** The id of a bundled template, by its key. */
export function getBundledTemplateId(key: string): number | null {
  return (
    getDatabase()
      .select({ id: slideTemplates.id })
      .from(slideTemplates)
      .where(eq(slideTemplates.bundledKey, key))
      .get()?.id ?? null
  )
}

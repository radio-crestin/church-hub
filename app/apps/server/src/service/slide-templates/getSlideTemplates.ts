import { asc, eq } from 'drizzle-orm'

import { toSlideTemplate } from './toSlideTemplate'
import type { SlideTemplate } from './types'
import { getDatabase } from '../../db'
import { slideTemplates } from '../../db/schema'

/** Every template: the church's own first, then the bundled ones. */
export function getSlideTemplates(): SlideTemplate[] {
  return getDatabase()
    .select()
    .from(slideTemplates)
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

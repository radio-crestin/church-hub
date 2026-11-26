import { eq, sql } from 'drizzle-orm'

import { parseTemplateJson } from './parseTemplateJson'
import { SlideTemplateError } from './SlideTemplateError'
import { getDatabase } from '../../db'
import { slideTemplates } from '../../db/schema'
import type { ContentType } from '../presentation/types'

/**
 * Saves one slide kind's layout, leaving the others as stored: a kind the
 * template never stored (first/last song slides) keeps following its `song`
 * layout instead of being frozen as it looks today.
 */
export function saveTemplateLayout(
  templateId: number,
  contentType: ContentType,
  layout: Record<string, unknown>,
): void {
  const db = getDatabase()
  const record = db
    .select({
      layouts: slideTemplates.layouts,
      bundledKey: slideTemplates.bundledKey,
    })
    .from(slideTemplates)
    .where(eq(slideTemplates.id, templateId))
    .get()
  if (!record) throw new SlideTemplateError('Template not found', 404)
  if (record.bundledKey) {
    throw new SlideTemplateError('A bundled template is read-only', 409)
  }
  const layouts = {
    ...parseTemplateJson(record.layouts, 'layouts'),
    [contentType]: layout,
  }
  db.update(slideTemplates)
    .set({
      layouts: JSON.stringify(layouts),
      updatedAt: sql`(unixepoch())` as unknown as Date,
    })
    .where(eq(slideTemplates.id, templateId))
    .run()
}

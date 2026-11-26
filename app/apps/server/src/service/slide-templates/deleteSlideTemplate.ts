import { eq } from 'drizzle-orm'

import { getSlideTemplate } from './getSlideTemplates'
import { getTemplateUsage, isTemplateUsed } from './getTemplateUsage'
import { SlideTemplateError } from './SlideTemplateError'
import { getDatabase } from '../../db'
import { slideTemplates } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('slide-templates')

/**
 * Deletes one of the church's templates. Refused for a bundled one and for
 * one a screen, an OBS scene or a presentation still draws with: the client
 * lists those so they can be moved to another template first.
 */
export function deleteSlideTemplate(id: number): void {
  const template = getSlideTemplate(id)
  if (!template) throw new SlideTemplateError('Template not found', 404)
  if (template.bundledKey) {
    throw new SlideTemplateError('A bundled template cannot be deleted', 409)
  }
  if (isTemplateUsed(getTemplateUsage(id))) {
    throw new SlideTemplateError('The template is still in use', 409)
  }
  getDatabase().delete(slideTemplates).where(eq(slideTemplates.id, id)).run()
  logger.info(`Template deleted: ${id}`)
}

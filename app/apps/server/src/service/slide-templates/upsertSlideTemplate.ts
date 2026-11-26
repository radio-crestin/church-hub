import { eq, sql } from 'drizzle-orm'

import { getSlideTemplate } from './getSlideTemplates'
import { SlideTemplateError } from './SlideTemplateError'
import type { SaveSlideTemplateInput, SlideTemplate } from './types'
import { getDatabase } from '../../db'
import { slideTemplates } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('slide-templates')

function toColumns(input: SaveSlideTemplateInput) {
  return {
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.width !== undefined && { width: input.width }),
    ...(input.height !== undefined && { height: input.height }),
    ...(input.layouts !== undefined && {
      layouts: JSON.stringify(input.layouts),
    }),
    ...(input.globalSettings !== undefined && {
      globalSettings: JSON.stringify(input.globalSettings),
    }),
    ...(input.nextSlide !== undefined && {
      nextSlide: JSON.stringify(input.nextSlide),
    }),
  }
}

/**
 * Creates a template (no id) or saves the given parts of one. A bundled
 * template is read-only: it is duplicated to be changed.
 */
export function upsertSlideTemplate(
  input: SaveSlideTemplateInput & { id?: number },
): SlideTemplate {
  const db = getDatabase()
  if (input.name !== undefined && !input.name.trim()) {
    throw new SlideTemplateError('A template needs a name', 400)
  }

  if (input.id === undefined) {
    if (!input.name) throw new SlideTemplateError('Missing name', 400)
    const { id } = db
      .insert(slideTemplates)
      .values({ name: input.name.trim(), ...toColumns(input) })
      .returning({ id: slideTemplates.id })
      .get()
    logger.info(`Template created: ${id} (${input.name})`)
    return getSlideTemplate(id) as SlideTemplate
  }

  const existing = getSlideTemplate(input.id)
  if (!existing) throw new SlideTemplateError('Template not found', 404)
  if (existing.bundledKey) {
    throw new SlideTemplateError(
      'A bundled template is read-only: duplicate it to change it',
      409,
    )
  }
  db.update(slideTemplates)
    .set({
      ...toColumns(input),
      updatedAt: sql`(unixepoch())` as unknown as Date,
    })
    .where(eq(slideTemplates.id, input.id))
    .run()
  logger.info(`Template saved: ${input.id}`)
  return getSlideTemplate(input.id) as SlideTemplate
}

/** A copy of a template (bundled or not) the church can change. */
export function duplicateSlideTemplate(
  id: number,
  name?: string,
): SlideTemplate {
  const source = getSlideTemplate(id)
  if (!source) throw new SlideTemplateError('Template not found', 404)
  return upsertSlideTemplate({
    name: name?.trim() || `${source.name} (copy)`,
    width: source.width,
    height: source.height,
    layouts: source.layouts,
    globalSettings: source.globalSettings,
    nextSlide: source.nextSlide,
  })
}

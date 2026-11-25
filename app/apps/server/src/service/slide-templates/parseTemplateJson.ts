import { createLogger } from '../../utils/logger'

const logger = createLogger('slide-templates')

/** A stored JSON column, or an empty object when it is unreadable (logged). */
export function parseTemplateJson(
  json: string,
  column: string,
): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch (error) {
    logger.error(`Unreadable ${column} JSON in a slide template: ${error}`)
    return {}
  }
}

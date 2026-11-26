import { getSlideTemplate } from '../../slide-templates/getSlideTemplates'

/** A topic draws with a shared template, never with a presentation's own. */
export function isTopicTemplate(templateId: number): boolean {
  const template = getSlideTemplate(templateId)
  return template !== null && template.scheduleId === null
}

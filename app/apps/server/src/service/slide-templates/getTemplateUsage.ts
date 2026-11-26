import { eq } from 'drizzle-orm'

import type { TemplateUsage } from './types'
import { getDatabase } from '../../db'
import {
  scheduleItems,
  schedules,
  screenSceneTemplates,
  screens,
} from '../../db/schema'

/** The screens, OBS scenes and presentations that draw with a template. */
export function getTemplateUsage(templateId: number): TemplateUsage {
  const db = getDatabase()
  const screenRows = db
    .select({ id: screens.id, name: screens.name })
    .from(screens)
    .where(eq(screens.templateId, templateId))
    .all()
  const sceneScreens = db
    .select({
      id: screens.id,
      name: screens.name,
      obsSceneName: screenSceneTemplates.obsSceneName,
    })
    .from(screenSceneTemplates)
    .innerJoin(screens, eq(screens.id, screenSceneTemplates.screenId))
    .where(eq(screenSceneTemplates.templateId, templateId))
    .all()
  const own = db
    .select({ id: schedules.id, title: schedules.title })
    .from(schedules)
    .where(eq(schedules.templateId, templateId))
    .all()
  const byItem = db
    .selectDistinct({ id: schedules.id, title: schedules.title })
    .from(scheduleItems)
    .innerJoin(schedules, eq(schedules.id, scheduleItems.scheduleId))
    .where(eq(scheduleItems.templateId, templateId))
    .all()
  const presentations = [
    ...new Map([...own, ...byItem].map((p) => [p.id, p])).values(),
  ]
  return { screens: screenRows, sceneScreens, presentations }
}

export function isTemplateUsed(usage: TemplateUsage): boolean {
  return (
    usage.screens.length > 0 ||
    usage.sceneScreens.length > 0 ||
    usage.presentations.length > 0
  )
}

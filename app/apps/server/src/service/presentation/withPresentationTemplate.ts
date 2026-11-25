import type { TemporaryContent } from './types'
import { buildScheduleSteps } from '../schedule-automation/buildScheduleSteps'
import { getScheduleById } from '../schedules'

interface TemplateRef {
  scheduleId?: number
  scheduleItemIndex?: number
  /** The template the screens that follow presentations draw it with. */
  templateId?: number | null
}

/** The item's own template, else its presentation's, else none. */
function scheduleTemplateId(
  scheduleId: number,
  stepIndex: number | undefined,
): number | null {
  const schedule = getScheduleById(scheduleId)
  if (!schedule) return null
  const step = buildScheduleSteps(schedule.items)[stepIndex ?? 0]
  return step?.item.templateId ?? schedule.templateId ?? null
}

/**
 * Content presented from a presentation carries the template its slide is
 * drawn with (CH-184), whoever presented it: an operator, the runner, a phone.
 * Other content keeps the template it was presented with, if any (a topic's
 * verse loop).
 */
export function withPresentationTemplate(
  content: TemporaryContent | null,
): TemporaryContent | null {
  if (!content) return content
  const data = content.data as TemplateRef
  if (data.scheduleId === undefined) return content
  return {
    ...content,
    data: {
      ...data,
      templateId: scheduleTemplateId(data.scheduleId, data.scheduleItemIndex),
    },
  } as typeof content
}

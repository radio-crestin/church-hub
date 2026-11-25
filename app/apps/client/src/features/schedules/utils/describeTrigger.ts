import type { TFunction } from 'i18next'

import type { AutomationTrigger } from '../types'

/** A trigger in a few words: "scene Predica is selected", "the livestream starts". */
export function describeTrigger(
  trigger: AutomationTrigger,
  t: TFunction<'schedules'>,
): string {
  return t(`automation.trigger.when.${trigger.event}`, {
    scene: trigger.sceneName,
  })
}

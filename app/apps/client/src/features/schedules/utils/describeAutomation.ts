import type { TFunction } from 'i18next'

import type { ScheduleAutomationSettings } from '../types'

/**
 * One short phrase per automation setting that is on, in the order the
 * settings appear: what the folded automation section says it will do.
 */
export function describeAutomation(
  automation: ScheduleAutomationSettings,
  t: TFunction<'schedules'>,
): string[] {
  const parts: string[] = []
  if (automation.autoplaySeconds != null)
    parts.push(
      t(
        automation.autoplayByText
          ? 'automation.summary.autoplayByText'
          : 'automation.summary.autoplay',
        { seconds: automation.autoplaySeconds },
      ),
    )
  if (automation.loop) parts.push(t('automation.summary.loop'))
  if (automation.musicVolume != null)
    parts.push(
      t('automation.summary.musicVolume', { volume: automation.musicVolume }),
    )
  if (automation.startOnAppStart)
    parts.push(t('automation.summary.startOnAppStart'))
  return parts
}

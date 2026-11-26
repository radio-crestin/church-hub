import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { useRunSchedule } from './useRunSchedule'
import { useScheduleAutomation } from './useScheduleAutomation'

const logger = createLogger('schedules:run')

/**
 * Run/Stop of one presentation, shared by the header button and the phone's
 * menu item: Run starts it from its first slide, Stop ends it while it runs.
 */
export function useScheduleRunToggle(scheduleId: number) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const { hasPermission } = usePermissions()
  const { data: automation } = useScheduleAutomation()
  const { run, stop } = useRunSchedule()

  const isRunning = !!(
    automation?.running && automation.scheduleId === scheduleId
  )
  const progress =
    isRunning && automation?.running
      ? `${automation.stepIndex + 1}/${automation.stepCount}`
      : null

  const toggle = async () => {
    try {
      if (isRunning) await stop.mutateAsync()
      else await run.mutateAsync(scheduleId)
    } catch (error) {
      logger.error('Run/Stop failed:', error)
      showToast(t('automation.runError'), 'error')
    }
  }

  return {
    allowed: hasPermission('control_room.control'),
    isRunning,
    isPending: run.isPending || stop.isPending,
    progress,
    label: isRunning ? t('automation.stop') : t('automation.run'),
    description: isRunning
      ? t('automation.stopDescription')
      : t('automation.runDescription'),
    toggle,
  }
}

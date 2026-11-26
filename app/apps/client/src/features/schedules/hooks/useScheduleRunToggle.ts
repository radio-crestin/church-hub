import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { useRunSchedule } from './useRunSchedule'
import { useScheduleAutomation } from './useScheduleAutomation'

const logger = createLogger('schedules:run')

/**
 * Run or stop a presentation: Run starts it from its first slide, and while
 * it runs the same control stops it. Shared by the header button and the
 * phone's actions menu.
 */
export function useScheduleRunToggle(scheduleId: number) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const { hasPermission } = usePermissions()
  const { data: automation } = useScheduleAutomation()
  const { run, stop } = useRunSchedule()

  const isRunning =
    automation?.running === true && automation.scheduleId === scheduleId

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
    canRun: hasPermission('control_room.control'),
    isRunning,
    isPending: run.isPending || stop.isPending,
    automation,
    label: isRunning ? t('automation.stop') : t('automation.run'),
    toggle,
  }
}

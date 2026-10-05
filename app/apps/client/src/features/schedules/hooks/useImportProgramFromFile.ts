import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useImportScheduleFromFile } from '~/features/schedule-import'
import { useToast } from '~/ui/toast'

/** Imports a program from a file and opens it. */
export function useImportProgramFromFile() {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { importSchedule, isPending } = useImportScheduleFromFile()

  async function importProgramFromFile() {
    const result = await importSchedule()
    if (result.success && result.scheduleId) {
      showToast(
        result.songsCreated
          ? t('messages.importedWithSongs', { count: result.songsCreated })
          : t('messages.imported'),
        'success',
      )
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(result.scheduleId) },
      })
    } else if (result.error) {
      showToast(result.error, 'error')
    }
  }

  return { importProgramFromFile, isPending }
}

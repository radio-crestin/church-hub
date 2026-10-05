import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSaveScheduleToFile } from '~/features/schedule-export'
import { useToast } from '~/ui/toast'
import { getScheduleById } from '../service/schedules'

/** Saves a program, looked up by id, to a file the user picks. */
export function useSaveProgramToFile() {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const { saveSchedule } = useSaveScheduleToFile()
  const [savingId, setSavingId] = useState<number | null>(null)

  async function saveProgramToFile(scheduleId: number) {
    setSavingId(scheduleId)
    try {
      const schedule = await getScheduleById(scheduleId)
      if (!schedule) {
        showToast(t('messages.error'), 'error')
        return
      }
      const result = await saveSchedule(schedule)
      if (result.success) {
        showToast(t('messages.savedToFile'), 'success')
      } else if (result.error) {
        showToast(result.error, 'error')
      }
    } catch {
      showToast(t('messages.error'), 'error')
    } finally {
      setSavingId(null)
    }
  }

  return { saveProgramToFile, savingId }
}

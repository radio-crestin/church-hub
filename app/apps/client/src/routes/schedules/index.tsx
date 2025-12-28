import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSaveScheduleToFile } from '~/features/schedule-export'
import { useImportScheduleFromFile } from '~/features/schedule-import'
import { ScheduleList } from '~/features/schedules/components'
import { getScheduleById } from '~/features/schedules/service/schedules'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { useToast } from '~/ui/toast'

export const Route = createFileRoute('/schedules/')({
  component: SchedulesPage,
})

function SchedulesPage() {
  const { t } = useTranslation('schedules')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { importSchedule, isPending: isImporting } = useImportScheduleFromFile()
  const { saveSchedule } = useSaveScheduleToFile()
  const [savingScheduleId, setSavingScheduleId] = useState<number | null>(null)

  const handleScheduleClick = (scheduleId: number) => {
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(scheduleId) },
    })
  }

  const handleSaveSchedule = async (scheduleId: number) => {
    setSavingScheduleId(scheduleId)
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
      setSavingScheduleId(null)
    }
  }

  const handleImportSchedule = async () => {
    const result = await importSchedule()
    if (result.success && result.scheduleId) {
      const message = result.songsCreated
        ? t('messages.importedWithSongs', { count: result.songsCreated })
        : t('messages.imported')
      showToast(message, 'success')
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(result.scheduleId) },
      })
    } else if (result.error) {
      showToast(result.error, 'error')
    }
  }

  return (
    <PagePermissionGuard permission="programs.view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImportSchedule}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {t('actions.importFromFile')}
            </button>
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: '/schedules/$scheduleId',
                  params: { scheduleId: 'new' },
                })
              }
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('actions.create')}
            </button>
          </div>
        </div>

        <ScheduleList
          onScheduleClick={handleScheduleClick}
          onSaveClick={handleSaveSchedule}
          savingScheduleId={savingScheduleId}
        />
      </div>
    </PagePermissionGuard>
  )
}

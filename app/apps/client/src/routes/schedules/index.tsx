import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSchedulesLastVisited } from '~/features/navigation'
import { useSaveScheduleToFile } from '~/features/schedule-export'
import { useImportScheduleFromFile } from '~/features/schedule-import'
import { ScheduleList } from '~/features/schedules/components'
import { getScheduleById } from '~/features/schedules/service/schedules'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { useToast } from '~/ui/toast'
import { Tooltip } from '~/ui/tooltip/Tooltip'

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
  const hasNavigatedOnOpen = useRef(false)

  // Auto-navigate to last visited schedule on initial page open
  useEffect(() => {
    if (hasNavigatedOnOpen.current) return

    const lastVisited = getSchedulesLastVisited()
    if (lastVisited?.scheduleId) {
      hasNavigatedOnOpen.current = true
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(lastVisited.scheduleId) },
      })
    }
  }, [navigate])

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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            <Tooltip content={t('actions.importFromFile')} position="bottom">
              <button
                type="button"
                onClick={handleImportSchedule}
                disabled={isImporting}
                className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isImporting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                <span className="hidden sm:inline">
                  {t('actions.importFromFile')}
                </span>
              </button>
            </Tooltip>
            <Tooltip content={t('actions.create')} position="bottom">
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: '/schedules/$scheduleId',
                    params: { scheduleId: 'new' },
                  })
                }
                className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">{t('actions.create')}</span>
              </button>
            </Tooltip>
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

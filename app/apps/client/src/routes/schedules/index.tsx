import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Upload } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getSchedulesLastVisited } from '~/features/navigation'
import { ScheduleList } from '~/features/schedules/components'
import {
  useImportProgramFromFile,
  useSaveProgramToFile,
} from '~/features/schedules/hooks'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { Tooltip } from '~/ui/tooltip/Tooltip'

export const Route = createFileRoute('/schedules/')({
  component: SchedulesPage,
})

function SchedulesPage() {
  const { t } = useTranslation('schedules')
  const navigate = useNavigate()
  const { importProgramFromFile, isPending: isImporting } =
    useImportProgramFromFile()
  const { saveProgramToFile, savingId } = useSaveProgramToFile()
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

  return (
    <PagePermissionGuard permission="programs.view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            <Tooltip content={t('actions.importFromFile')} position="bottom">
              <button
                type="button"
                onClick={importProgramFromFile}
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
          onSaveClick={saveProgramToFile}
          savingScheduleId={savingId}
        />
      </div>
    </PagePermissionGuard>
  )
}

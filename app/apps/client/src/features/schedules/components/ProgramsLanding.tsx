import { useNavigate } from '@tanstack/react-router'
import { CalendarDays, Loader2, Plus, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSchedulesLastVisited } from '~/features/navigation'
import { usePermissions } from '~/provider/permissions-provider'
import { CreateScheduleModal } from './CreateScheduleModal'
import { useImportProgramFromFile } from '../hooks/useImportProgramFromFile'
import { useSchedules } from '../hooks/useSchedules'

/**
 * "Programs" has no list page: programs are listed in the sidebar. This
 * opens the last program used (else the newest); with none yet, it offers
 * to make or import the first one.
 */
export function ProgramsLanding() {
  const { t } = useTranslation('schedules')
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const { data: schedules, isLoading } = useSchedules()
  const { importProgramFromFile, isPending: isImporting } =
    useImportProgramFromFile()
  const [isCreating, setIsCreating] = useState(false)

  const openProgram = (scheduleId: number) =>
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(scheduleId) },
      replace: true,
    })

  const lastVisitedId = getSchedulesLastVisited()?.scheduleId
  const programToOpen =
    schedules?.find((s) => s.id === lastVisitedId) ??
    [...(schedules ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0]

  useEffect(() => {
    if (programToOpen) openProgram(programToOpen.id)
  }, [programToOpen?.id])

  if (isLoading || programToOpen) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    )
  }

  const canCreate = hasPermission('programs.create')

  return (
    <div
      data-testid="programs-empty"
      className="mx-auto max-w-md text-center py-12 px-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
    >
      <CalendarDays
        size={48}
        className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
      />
      <p className="text-gray-700 dark:text-gray-300 font-medium">
        {t('noSchedules')}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {t('sidebar.emptyHint')}
      </p>
      {canCreate && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('sidebar.newProgram')}
          </button>
          <button
            type="button"
            onClick={importProgramFromFile}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {t('actions.importFromFile')}
          </button>
        </div>
      )}
      <CreateScheduleModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onCreated={openProgram}
      />
    </div>
  )
}

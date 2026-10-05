import { useLocation, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSyncUpdatesMap } from '~/features/sync'
import { usePermissions } from '~/provider/permissions-provider'
import { ConfirmModal } from '~/ui/modal'
import { normalizeForSearch } from '~/utils/normalizeForSearch'
import { SidebarProgramRow } from './SidebarProgramRow'
import { useConfirmDeleteProgram } from '../../hooks/useConfirmDeleteProgram'
import { useImportProgramFromFile } from '../../hooks/useImportProgramFromFile'
import { useSaveProgramToFile } from '../../hooks/useSaveProgramToFile'
import { useSchedules } from '../../hooks/useSchedules'
import { useSearchSchedules } from '../../hooks/useSearchSchedules'
import type { Schedule } from '../../types'
import { CreateScheduleModal } from '../CreateScheduleModal'
import { RenameScheduleModal } from '../RenameScheduleModal'

/** More programs than this and the list gets a filter box. */
const FILTER_FROM = 8

function openProgramId(pathname: string): number | null {
  const match = pathname.match(/^\/schedules\/(\d+)/)
  return match ? Number(match[1]) : null
}

/** The programs under the sidebar's "Programs" entry, newest first. */
export function SidebarProgramList() {
  const { t } = useTranslation('schedules')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hasPermission } = usePermissions()
  const { data: schedules, isLoading } = useSchedules()
  const syncUpdates = useSyncUpdatesMap('schedule')
  const { saveProgramToFile } = useSaveProgramToFile()
  const { importProgramFromFile, isPending: isImporting } =
    useImportProgramFromFile()
  const deletion = useConfirmDeleteProgram()
  const [filter, setFilter] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [renaming, setRenaming] = useState<Schedule | null>(null)

  const activeId = openProgramId(pathname)
  const canCreate = hasPermission('programs.create')

  const newestFirst = useMemo(
    () => [...(schedules ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [schedules],
  )
  // The server also finds programs by the songs and verses in them; until it
  // answers, titles are matched here.
  const query = filter.trim()
  const { data: searchResults } = useSearchSchedules(query)
  const shown = useMemo(() => {
    if (!query) return newestFirst
    if (searchResults) {
      const byId = new Map(newestFirst.map((s) => [s.id, s]))
      return searchResults.flatMap((r) => byId.get(r.id) ?? [])
    }
    const needle = normalizeForSearch(query)
    return newestFirst.filter((s) =>
      normalizeForSearch(s.title).includes(needle),
    )
  }, [newestFirst, query, searchResults])

  const openProgram = (scheduleId: number) =>
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(scheduleId) },
    })

  return (
    <div data-testid="sidebar-program-list" className="mt-1 ml-6 space-y-1">
      {newestFirst.length > FILTER_FROM && (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            data-testid="sidebar-program-filter"
            className="w-full pl-8 pr-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}

      {isLoading ? (
        <Loader2 size={16} className="ml-3 animate-spin text-gray-400" />
      ) : newestFirst.length === 0 ? (
        <p className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
          {t('noSchedules')}
        </p>
      ) : shown.length === 0 ? (
        <p className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
          {t('search.noResults', { query: filter })}
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto scrollbar-thin space-y-0.5">
          {shown.map((schedule) => (
            <SidebarProgramRow
              key={schedule.id}
              schedule={schedule}
              isActive={schedule.id === activeId}
              syncChangeKind={syncUpdates.get(schedule.id)}
              onRename={setRenaming}
              onSaveToFile={saveProgramToFile}
              onDelete={deletion.askToDelete}
            />
          ))}
        </ul>
      )}

      {canCreate && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            data-testid="sidebar-program-new"
            className="flex flex-1 items-center gap-2 py-1.5 pl-3 pr-2 text-sm rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
          >
            <Plus size={14} className="flex-shrink-0" />
            <span className="truncate">{t('sidebar.newProgram')}</span>
          </button>
          <button
            type="button"
            onClick={importProgramFromFile}
            disabled={isImporting}
            aria-label={t('sidebar.importProgram')}
            title={t('sidebar.importProgram')}
            data-testid="sidebar-program-import"
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
          </button>
        </div>
      )}

      <CreateScheduleModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onCreated={openProgram}
      />
      <RenameScheduleModal
        schedule={renaming}
        onClose={() => setRenaming(null)}
      />
      <ConfirmModal
        isOpen={deletion.pending !== null}
        title={t('panel.deleteScheduleTitle')}
        message={t('panel.deleteScheduleMessage', {
          title: deletion.pending?.title ?? '',
          count: deletion.pending?.itemCount ?? 0,
        })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('modal.cancel')}
        variant="danger"
        onConfirm={deletion.confirmDelete}
        onCancel={deletion.cancel}
        testId="sidebar-program-delete-confirm"
      />
    </div>
  )
}

import { Link } from '@tanstack/react-router'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SyncChangeKind } from '~/features/sync'
import { usePermissions } from '~/provider/permissions-provider'
import { ActionMenu, type ActionMenuItem } from '~/ui/menu'
import type { Schedule } from '../../types'

interface SidebarProgramRowProps {
  schedule: Schedule
  isActive: boolean
  syncChangeKind?: SyncChangeKind
  onRename: (schedule: Schedule) => void
  onSaveToFile: (scheduleId: number) => void
  onDelete: (schedule: Schedule) => void
}

/** One program in the sidebar: opens it, and its menu renames, saves or deletes it. */
export function SidebarProgramRow({
  schedule,
  isActive,
  syncChangeKind,
  onRename,
  onSaveToFile,
  onDelete,
}: SidebarProgramRowProps) {
  const { t } = useTranslation(['schedules', 'common'])
  const { hasPermission } = usePermissions()

  const menuItems: ActionMenuItem[] = [
    ...(hasPermission('programs.edit')
      ? [
          {
            id: 'rename',
            label: t('actions.rename'),
            icon: <Pencil size={16} />,
            iconClassName:
              'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
            onSelect: () => onRename(schedule),
            testId: 'sidebar-program-rename',
          },
        ]
      : []),
    {
      id: 'save-to-file',
      label: t('actions.saveToFile'),
      icon: <Download size={16} />,
      iconClassName:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      onSelect: () => onSaveToFile(schedule.id),
      testId: 'sidebar-program-save',
    },
    ...(hasPermission('programs.delete')
      ? [
          {
            id: 'delete',
            label: t('actions.delete'),
            icon: <Trash2 size={16} />,
            iconClassName:
              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
            onSelect: () => onDelete(schedule),
            testId: 'sidebar-program-delete',
          },
        ]
      : []),
  ]

  return (
    <li
      data-testid="sidebar-program"
      data-active={isActive}
      className={`group flex items-center gap-1 rounded-md pr-1 transition-colors ${
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Link
        to="/schedules/$scheduleId"
        params={{ scheduleId: String(schedule.id) }}
        title={schedule.title}
        aria-current={isActive ? 'page' : undefined}
        className="flex flex-1 min-w-0 items-center gap-2 py-1.5 pl-3 text-sm"
      >
        <span className="truncate">{schedule.title}</span>
        {syncChangeKind && (
          <span
            title={t(
              syncChangeKind === 'conflict'
                ? 'common:sync.conflictTooltip'
                : 'common:sync.updatedTooltip',
            )}
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              syncChangeKind === 'conflict' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
        )}
        <span className="ml-auto flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {schedule.itemCount}
        </span>
      </Link>
      <div className="flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:has-[[aria-expanded=true]]:opacity-100 transition-opacity">
        <ActionMenu
          items={menuItems}
          label={t('sidebar.programActions', { title: schedule.title })}
          testId="sidebar-program-menu"
          size="compact"
        />
      </div>
    </li>
  )
}

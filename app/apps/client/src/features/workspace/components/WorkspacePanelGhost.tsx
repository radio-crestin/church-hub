import { GripHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface WorkspacePanelGhostProps {
  title: string
}

/**
 * Stands in for a panel while it is being dragged.
 *
 * The panel's real content is expensive to move around mid-drag, so the slot it
 * would land in shows this outline instead — same size, same place, named — and
 * every other panel flows around it in real time. Dropping puts the real thing
 * exactly where the outline was.
 */
export function WorkspacePanelGhost({ title }: WorkspacePanelGhostProps) {
  const { t } = useTranslation('common')

  return (
    <div
      data-testid="workspace-panel-ghost"
      className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-indigo-500 bg-indigo-100/80 p-2 text-center dark:border-indigo-400 dark:bg-indigo-500/20"
    >
      <GripHorizontal
        size={16}
        className="text-indigo-500 dark:text-indigo-300"
      />
      <span className="truncate text-sm font-medium text-indigo-900 dark:text-indigo-100">
        {title}
      </span>
      <span className="truncate text-xs text-indigo-600 dark:text-indigo-300">
        {t('workspace.newPosition')}
      </span>
    </div>
  )
}

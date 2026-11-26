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
      className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-focus bg-focus/10 p-2 text-center"
    >
      <GripHorizontal size={16} strokeWidth={1.5} className="text-fg-label" />
      <span className="truncate text-sm font-medium text-fg">{title}</span>
      <span className="truncate text-xs text-fg-hint">
        {t('workspace.newPosition')}
      </span>
    </div>
  )
}

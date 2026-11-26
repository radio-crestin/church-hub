import { Check, LayoutGrid, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface WorkspaceEditToolbarProps {
  /** `true` once the arrangement differs from the page's default. */
  isCustomised: boolean
  onReset: () => void
  onDone: () => void
}

/**
 * The bar that sits above the panels while the page is being rearranged. It is
 * the only thing that says "you are in a mode": it names the mode, says how to
 * move a panel, and gives the two ways out — back to the default arrangement,
 * or done.
 */
export function WorkspaceEditToolbar({
  isCustomised,
  onReset,
  onDone,
}: WorkspaceEditToolbarProps) {
  const { t } = useTranslation('common')

  return (
    <div
      data-testid="workspace-edit-toolbar"
      className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2"
    >
      <LayoutGrid
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-fg-label"
      />
      <span className="text-[13px] font-medium text-fg">
        {t('workspace.layout')}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-fg-hint">
        {t('workspace.editingHint')}
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={!isCustomised}
        data-testid="workspace-reset-layout"
        className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-field px-3 text-[13px] font-medium text-fg transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw size={14} strokeWidth={1.75} />
        {t('workspace.resetLayout')}
      </button>
      <button
        type="button"
        onClick={onDone}
        data-testid="workspace-done-editing"
        className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700"
      >
        <Check size={14} strokeWidth={1.75} />
        {t('workspace.doneEditing')}
      </button>
    </div>
  )
}

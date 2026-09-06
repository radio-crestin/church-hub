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
      className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-900/30"
    >
      <LayoutGrid
        size={16}
        className="shrink-0 text-indigo-600 dark:text-indigo-300"
      />
      <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
        {t('workspace.layout')}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-indigo-700 dark:text-indigo-300">
        {t('workspace.editingHint')}
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={!isCustomised}
        data-testid="workspace-reset-layout"
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-700 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
      >
        <RotateCcw size={14} />
        {t('workspace.resetLayout')}
      </button>
      <button
        type="button"
        onClick={onDone}
        data-testid="workspace-done-editing"
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
      >
        <Check size={14} />
        {t('workspace.doneEditing')}
      </button>
    </div>
  )
}

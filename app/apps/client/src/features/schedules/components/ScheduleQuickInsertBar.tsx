import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tooltip } from '~/ui/tooltip/Tooltip'

interface ScheduleQuickInsertBarProps {
  /** The entry above the bar: what is inserted lands right after it. */
  afterTitle: string
  onInsert: () => void
}

/**
 * A thin line between two program entries. Pointing at it shows one
 * "Inserează element" button, which opens the add-item menu; what is picked
 * lands right there instead of at the end. Always shown on touch screens.
 */
export function ScheduleQuickInsertBar({
  afterTitle,
  onInsert,
}: ScheduleQuickInsertBarProps) {
  const { t } = useTranslation('schedules')
  const tooltip = t('quickInsert.tooltip', { title: afterTitle })

  return (
    <div
      data-testid="schedule-quick-insert-bar"
      className="group/insert relative -my-1 flex h-4 items-center justify-center"
    >
      <div className="absolute inset-x-2 top-1/2 h-px bg-indigo-300 opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 dark:bg-indigo-700" />
      <div className="relative z-10 opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 [@media(hover:none)]:opacity-100">
        <Tooltip content={tooltip} position="top">
          <button
            type="button"
            onClick={onInsert}
            aria-label={tooltip}
            data-testid="schedule-quick-insert"
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm ring-1 ring-black/5 transition-colors text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60"
          >
            <Plus size={12} />
            {t('quickInsert.button')}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

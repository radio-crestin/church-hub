import { Camera, FileText, Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tooltip } from '~/ui/tooltip/Tooltip'

/** What the bar between two program entries can insert right there. */
export type QuickInsertKind = 'song' | 'verses' | 'scene'

interface ScheduleQuickInsertBarProps {
  /** The entry above the bar: what is inserted lands right after it. */
  afterTitle: string
  onInsert: (kind: QuickInsertKind) => void
}

const BUTTONS: {
  kind: QuickInsertKind
  icon: typeof Music
  labelKey: string
  colorClass: string
}[] = [
  {
    kind: 'song',
    icon: Music,
    labelKey: 'addMenu.song',
    colorClass:
      'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60',
  },
  {
    kind: 'verses',
    icon: FileText,
    labelKey: 'addMenu.verseteTineri',
    colorClass:
      'text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-900/40 dark:hover:bg-green-900/60',
  },
  {
    kind: 'scene',
    icon: Camera,
    labelKey: 'addMenu.scene',
    colorClass:
      'text-violet-700 bg-violet-50 hover:bg-violet-100 dark:text-violet-300 dark:bg-violet-900/40 dark:hover:bg-violet-900/60',
  },
]

/**
 * A thin line between two program entries. Pointing at it shows the most
 * used inserts (song, Bible verses, OBS scene), which land right there
 * instead of at the end of the program. Always shown on touch screens.
 */
export function ScheduleQuickInsertBar({
  afterTitle,
  onInsert,
}: ScheduleQuickInsertBarProps) {
  const { t } = useTranslation('common')
  const { t: tSchedules } = useTranslation('schedules')

  return (
    <div
      data-testid="schedule-quick-insert-bar"
      className="group/insert relative -my-1 flex h-4 items-center justify-center"
    >
      <div className="absolute inset-x-2 top-1/2 h-px bg-indigo-300 opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 dark:bg-indigo-700" />
      <div className="relative z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100 [@media(hover:none)]:opacity-100">
        {BUTTONS.map(({ kind, icon: Icon, labelKey, colorClass }) => {
          const label = tSchedules(`quickInsert.${kind}`, {
            title: afterTitle,
          })
          return (
            <Tooltip key={kind} content={label} position="top">
              <button
                type="button"
                onClick={() => onInsert(kind)}
                aria-label={label}
                data-testid={`schedule-quick-insert-${kind}`}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm ring-1 ring-black/5 transition-colors ${colorClass}`}
              >
                <Icon size={12} />
                {t(labelKey)}
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

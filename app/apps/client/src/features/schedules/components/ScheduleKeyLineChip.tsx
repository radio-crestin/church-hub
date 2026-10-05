import { useTranslation } from 'react-i18next'

interface ScheduleKeyLineChipProps {
  keyLine: string | null
  /** Opens the gama editor; without it the gama is shown read-only. */
  onEdit?: () => void
  testId: string
}

/**
 * A program song's gama ("key line"). A song without one shows a muted
 * "No key" hint, so the songs still missing a gama stand out; clicking either
 * opens the same editor the Marcaje and the song page use.
 */
export function ScheduleKeyLineChip({
  keyLine,
  onEdit,
  testId,
}: ScheduleKeyLineChipProps) {
  const { t } = useTranslation('schedules')
  const colorClass = keyLine
    ? 'text-amber-600 dark:text-amber-400'
    : 'border border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
  const className = `max-w-[8rem] shrink-0 truncate rounded px-1 text-xs ${colorClass}`
  const label = keyLine || t('keyLine.missing')

  if (!onEdit) {
    if (!keyLine) return null
    return (
      <span className={className} data-testid={testId}>
        {keyLine}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onEdit()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={t('contextMenu.editKeyLine')}
      data-testid={testId}
      data-missing={keyLine ? undefined : 'true'}
      className={`${className} hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-300`}
    >
      {label}
    </button>
  )
}

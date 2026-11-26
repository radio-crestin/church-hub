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
  // The "no key" hint is left out on a phone, where the title needs the
  // room; the row's menu still sets the key there.
  const colorClass = keyLine
    ? 'font-medium text-key'
    : 'max-sm:hidden border border-dashed border-line-strong text-fg-hint'
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
      className={`${className} hover:bg-hover`}
    >
      {label}
    </button>
  )
}

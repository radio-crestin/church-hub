import { CalendarCheck, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { todayProgramTitle } from '../utils/todayProgramTitle'

interface TodayProgramButtonProps {
  onClick: () => void
  disabled?: boolean
  isPending?: boolean
  testId: string
}

/** "Today": makes (or reuses) the program named after today's date, in one click. */
export function TodayProgramButton({
  onClick,
  disabled,
  isPending,
  testId,
}: TodayProgramButtonProps) {
  const { t } = useTranslation('schedules')
  const hint = t('today.hint', { title: todayProgramTitle() })

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPending}
      title={hint}
      aria-label={hint}
      data-testid={testId}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <CalendarCheck size={16} />
      )}
      {t('today.button')}
    </button>
  )
}

import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ScheduleSungToggleProps {
  isSung: boolean
  onToggle: () => void
  /**
   * A passage is "read" rather than "sung"; everything else takes the sung
   * wording. Only the label changes — the marker is one field on the item.
   */
  variant?: 'sung' | 'read'
  /** Kept per-kind so existing tests keep addressing the row they know. */
  testId?: string
}

/**
 * The done-marker every program item carries: songs, readings, announcements,
 * Versete Tineri and OBS scenes alike. One component so the circle, the tick
 * and the colours can never drift between the lists that show them.
 */
export function ScheduleSungToggle({
  isSung,
  onToggle,
  variant = 'sung',
  testId = 'schedule-item-sung-toggle',
}: ScheduleSungToggleProps) {
  const { t } = useTranslation('schedules')

  const title =
    variant === 'read'
      ? isSung
        ? t('panel.markNotRead')
        : t('panel.markRead')
      : isSung
        ? t('panel.markNotSung')
        : t('panel.markSung')

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={isSung}
      title={title}
      data-testid={testId}
      className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
        isSung
          ? 'border-green-500 bg-green-500 text-white'
          : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-green-400 hover:text-green-400'
      }`}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  )
}

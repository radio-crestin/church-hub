import { useTranslation } from 'react-i18next'

interface CountPickerProps {
  /** null = all of them, in order. */
  count: number | null
  onChange: (count: number | null) => void
  /** Whether "all, in order" is offered (a whole book is not). */
  allowAll: boolean
  testId: string
}

export const DEFAULT_PICK_COUNT = 5

/** How many passages an item shows: all in order, or N picked at random. */
export function CountPicker({
  count,
  onChange,
  allowAll,
  testId,
}: CountPickerProps) {
  const { t } = useTranslation('schedules')
  const random = count !== null || !allowAll

  return (
    <fieldset className="space-y-2" data-testid={testId}>
      {allowAll && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            checked={!random}
            onChange={() => onChange(null)}
          />
          {t('mediaItems.count.all')}
        </label>
      )}
      <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        {allowAll && (
          <input
            type="radio"
            checked={random}
            onChange={() => onChange(count ?? DEFAULT_PICK_COUNT)}
          />
        )}
        <input
          type="number"
          min={1}
          max={100}
          value={count ?? DEFAULT_PICK_COUNT}
          disabled={!random}
          aria-label={t('mediaItems.count.label')}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value, 10)
            if (value > 0) onChange(Math.min(value, 100))
          }}
          className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        {t('mediaItems.count.random')}
      </label>
    </fieldset>
  )
}

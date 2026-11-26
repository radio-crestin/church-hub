import { Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SLIDE_LABELS } from '../../utils/slideLabels'

interface SlideLabelSelectProps {
  label: string | null | undefined
  onChange: (label: string | null) => void
  disabled?: boolean
}

/** The slide's label (V1, C1, Bridge, …), or none. */
export function SlideLabelSelect({
  label,
  onChange,
  disabled,
}: SlideLabelSelectProps) {
  const { t } = useTranslation('songs')
  const current = label ?? ''
  // A label typed as text (or imported) that is not one of the presets.
  const options =
    current && !SLIDE_LABELS.includes(current)
      ? [current, ...SLIDE_LABELS]
      : SLIDE_LABELS

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
      <Tag size={13} className="text-gray-400" />
      <span className="sr-only">{t('chords.setLabel')}</span>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        data-testid="slide-label-select"
        title={t('chords.setLabel')}
        className="rounded-md border border-gray-200 bg-white py-1 pl-2 pr-7 text-xs font-medium text-gray-700 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        <option value="">{t('songEditor.noLabel')}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

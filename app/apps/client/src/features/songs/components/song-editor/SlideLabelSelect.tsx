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
    <label className="inline-flex items-center gap-1.5 text-xs text-fg-label">
      <Tag size={13} className="text-fg-hint" />
      <span className="sr-only">{t('chords.setLabel')}</span>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        data-testid="slide-label-select"
        title={t('chords.setLabel')}
        className="rounded-md border border-line bg-panel py-1 pl-2 pr-7 text-xs font-medium text-fg-body focus:border-focus focus:ring-1 focus:ring-focus"
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

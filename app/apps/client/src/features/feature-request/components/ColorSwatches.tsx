import { useTranslation } from 'react-i18next'

import { MARKUP_COLORS } from '../utils/markupColors'

interface ColorSwatchesProps {
  color: string
  onChange: (color: string) => void
}

/** Round colour dots; the chosen one gets a ring, as in iPad Markup. */
export function ColorSwatches({ color, onChange }: ColorSwatchesProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5">
      {MARKUP_COLORS.map(({ value, nameKey }) => (
        <button
          key={value}
          type="button"
          data-testid={`feature-request-color-${value.slice(1)}`}
          aria-label={t(nameKey)}
          title={t(nameKey)}
          aria-pressed={color === value}
          onClick={() => onChange(value)}
          className={`w-7 h-7 rounded-full border border-black/20 dark:border-white/30 transition-transform hover:scale-110 ${color === value ? 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-white dark:ring-offset-gray-800 scale-110' : ''}`}
          style={{ backgroundColor: value }}
        />
      ))}
    </div>
  )
}

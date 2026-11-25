import { AArrowDown, AArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { useFontScale } from '~/hooks/useFontScale'

const BUTTON_CLASS =
  'flex items-center justify-center p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

interface FontSizeButtonsProps {
  fontScale: ReturnType<typeof useFontScale>
  /** Prefix of the buttons' test ids: `<prefix>-decrease`, `<prefix>-increase`. */
  testIdPrefix: string
}

/** The A↓ / A↑ pair that resizes a reading list's text. */
export function FontSizeButtons({
  fontScale,
  testIdPrefix,
}: FontSizeButtonsProps) {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={fontScale.decrease}
        disabled={!fontScale.canDecrease}
        title={t('fontSize.decrease')}
        aria-label={t('fontSize.decrease')}
        data-testid={`${testIdPrefix}-decrease`}
        className={BUTTON_CLASS}
      >
        <AArrowDown size={16} />
      </button>
      <button
        type="button"
        onClick={fontScale.increase}
        disabled={!fontScale.canIncrease}
        title={t('fontSize.increase')}
        aria-label={t('fontSize.increase')}
        data-testid={`${testIdPrefix}-increase`}
        className={BUTTON_CLASS}
      >
        <AArrowUp size={18} />
      </button>
    </div>
  )
}

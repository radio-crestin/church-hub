import { useTranslation } from 'react-i18next'

import { QUEUE_ORDERS, type QueueOrder } from '../types'

interface QueueOrderPickerProps {
  order: QueueOrder
  onChange: (order: QueueOrder) => void
}

/** What plays next: in order, at random, the most or the least played. */
export function QueueOrderPicker({ order, onChange }: QueueOrderPickerProps) {
  const { t } = useTranslation('music')

  return (
    <div
      role="radiogroup"
      aria-label={t('player.order')}
      className="flex flex-wrap gap-1.5"
      data-testid="music-queue-order"
    >
      {QUEUE_ORDERS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={order === option}
          onClick={() => onChange(option)}
          data-testid={`music-queue-order-${option}`}
          className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
            order === option
              ? 'bg-selected text-fg'
              : 'bg-field text-fg-label hover:bg-hover hover:text-fg'
          }`}
        >
          {t(`player.orders.${option}`)}
        </button>
      ))}
    </div>
  )
}

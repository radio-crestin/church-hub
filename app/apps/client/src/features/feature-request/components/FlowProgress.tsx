import { useTranslation } from 'react-i18next'

interface FlowProgressProps {
  current: number
  total: number
}

/** "Step 1 of 2" with one bar per step, the done ones filled. */
export function FlowProgress({ current, total }: FlowProgressProps) {
  const { t } = useTranslation()
  return (
    <div
      data-testid="feature-request-progress"
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${index < current ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {t('common:featureRequest.stepLabel', { current, total })}
      </span>
    </div>
  )
}

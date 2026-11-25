import { useTranslation } from 'react-i18next'

interface EventListProps {
  title: string
  /** `clientEvents` or `serverEvents` in the privacy namespace. */
  namespace: 'clientEvents' | 'serverEvents'
  events: Record<string, readonly string[]>
}

/** The events from analyticsEvents.ts, each with what it means and sends. */
export function EventList({ title, namespace, events }: EventListProps) {
  const { t } = useTranslation('privacy')
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </h4>
      <ul className="mt-2 space-y-2" data-testid={`privacy-${namespace}`}>
        {Object.entries(events).map(([name, properties]) => (
          <li key={name} className="text-sm text-gray-700 dark:text-gray-300">
            <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
              {name}
            </code>{' '}
            {t(`${namespace}.${name}`)}
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('policy.propertiesLabel')}:{' '}
              {properties.length > 0
                ? properties.join(', ')
                : t('policy.noProperties')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

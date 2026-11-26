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
      <h4 className="text-sm font-medium text-fg">{title}</h4>
      <ul className="mt-2 space-y-2" data-testid={`privacy-${namespace}`}>
        {Object.entries(events).map(([name, properties]) => (
          <li key={name} className="text-sm text-fg-body">
            <code className="rounded bg-field px-1 text-xs">{name}</code>{' '}
            {t(`${namespace}.${name}`)}
            <span className="block text-xs text-fg-hint">
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

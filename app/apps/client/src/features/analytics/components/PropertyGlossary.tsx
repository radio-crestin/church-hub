import { useTranslation } from 'react-i18next'

import {
  CLIENT_EVENTS,
  COMMON_PROPERTIES,
  SERVER_EVENTS,
} from '../analyticsEvents'

const ALL_PROPERTIES = [
  ...new Set([
    ...COMMON_PROPERTIES,
    ...Object.values(CLIENT_EVENTS).flat(),
    ...Object.values(SERVER_EVENTS).flat(),
  ]),
]

/** Every property name sent, with what it holds. */
export function PropertyGlossary() {
  const { t } = useTranslation('privacy')
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        {t('policy.propertiesTitle')}
      </h4>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {ALL_PROPERTIES.map((name) => (
          <div key={name} className="contents">
            <dt>
              <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
                {name}
              </code>
            </dt>
            <dd className="mb-1 text-gray-700 dark:text-gray-300 sm:mb-0">
              {t(`properties.${name}`)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

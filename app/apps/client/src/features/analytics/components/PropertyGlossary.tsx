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
      <h4 className="text-[13px] font-medium text-fg">
        {t('policy.propertiesTitle')}
      </h4>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
        {ALL_PROPERTIES.map((name) => (
          <div key={name} className="contents">
            <dt>
              <code className="rounded bg-field px-1 text-xs">{name}</code>
            </dt>
            <dd className="mb-1 text-fg-body sm:mb-0">
              {t(`properties.${name}`)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

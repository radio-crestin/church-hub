import { useTranslation } from 'react-i18next'

import { EventList } from './EventList'
import { PolicyParagraph } from './PolicyParagraph'
import { PropertyGlossary } from './PropertyGlossary'
import {
  CLIENT_EVENTS,
  COMMON_PROPERTIES,
  SERVER_EVENTS,
} from '../analyticsEvents'

/**
 * The privacy policy, its event list drawn from analyticsEvents.ts so it
 * always says what the code sends. Mirrored in docs/privacy-policy.md.
 */
export function PrivacyPolicy() {
  const { t } = useTranslation('privacy')
  const paragraph = (key: string) => (
    <PolicyParagraph
      key={key}
      title={t(`policy.${key}Title`)}
      text={t(`policy.${key}`)}
    />
  )

  return (
    <article className="space-y-5" data-testid="privacy-policy">
      <p className="text-[13px] text-fg-body">{t('policy.intro')}</p>
      <h3 className="text-base font-semibold text-fg">
        {t('policy.whatTitle')}
      </h3>
      <EventList
        title={t('policy.clientEventsTitle')}
        namespace="clientEvents"
        events={CLIENT_EVENTS}
      />
      <EventList
        title={t('policy.serverEventsTitle')}
        namespace="serverEvents"
        events={SERVER_EVENTS}
      />
      <PolicyParagraph
        title={t('policy.commonTitle')}
        text={COMMON_PROPERTIES.join(', ')}
      />
      {['device', 'replay'].map(paragraph)}
      <PropertyGlossary />
      {[
        'why',
        'where',
        'retention',
        'anonymous',
        'never',
        'feedback',
        'off',
      ].map(paragraph)}
    </article>
  )
}

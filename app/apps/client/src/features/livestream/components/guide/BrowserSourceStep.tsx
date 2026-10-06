import { useTranslation } from 'react-i18next'

import { useScreens } from '~/features/presentation/hooks/useScreens'
import { getFrontendUrl } from '~/features/presentation/utils/openDisplayWindow'
import { CopyValue } from './CopyValue'
import { GuideSettingsLink } from './GuideSettingsLink'
import { GuideStep } from './GuideStep'

interface BrowserSourceStepProps {
  number: number
  onNavigate: () => void
}

/** The Live Stream screen's address and size, for an OBS Browser source. */
export function BrowserSourceStep({
  number,
  onNavigate,
}: BrowserSourceStepProps) {
  const { t } = useTranslation('livestream')
  const { data: screens } = useScreens()
  const screen = screens?.find((s) => s.type === 'livestream')

  return (
    <GuideStep number={number} title={t('guide.browserSource.title')}>
      <p>{t('guide.browserSource.description')}</p>
      {screen ? (
        <div className="space-y-2">
          <CopyValue
            label={t('guide.browserSource.address')}
            value={`${getFrontendUrl()}/screen/${screen.id}`}
          />
          <CopyValue
            label={t('guide.browserSource.size')}
            value={`${screen.width} × ${screen.height}`}
          />
        </div>
      ) : (
        <p>{t('guide.browserSource.noScreen')}</p>
      )}
      <p>{t('guide.browserSource.looks')}</p>
      <GuideSettingsLink
        to="/settings/screens"
        label={t('guide.browserSource.openScreens')}
        onNavigate={onNavigate}
      />
    </GuideStep>
  )
}

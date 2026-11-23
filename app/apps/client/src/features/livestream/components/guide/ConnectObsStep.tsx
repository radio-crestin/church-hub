import { useTranslation } from 'react-i18next'

import { GuideSettingsLink } from './GuideSettingsLink'
import { GuideStep } from './GuideStep'
import { Button } from '../../../../ui/button/Button'
import { useOBSConnection } from '../../hooks'
import { openExternalUrl } from '../../utils'

const OBS_DOWNLOAD_URL = 'https://obsproject.com/download'

interface ConnectObsStepProps {
  number: number
  onNavigate: () => void
}

export function ConnectObsStep({ number, onNavigate }: ConnectObsStepProps) {
  const { t } = useTranslation('livestream')
  const { isConnected } = useOBSConnection()

  return (
    <GuideStep
      number={number}
      title={t('guide.obs.title')}
      isDone={isConnected}
    >
      <p>{t('guide.obs.install')}</p>
      <p>{t('guide.obs.connect')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <GuideSettingsLink
          to="/livestream/obs"
          label={t('guide.obs.openSetup')}
          onNavigate={onNavigate}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openExternalUrl(OBS_DOWNLOAD_URL)}
        >
          {t('guide.obs.download')}
        </Button>
      </div>
    </GuideStep>
  )
}

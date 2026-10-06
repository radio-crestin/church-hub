import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GuideStep } from './GuideStep'
import { Button } from '../../../../ui/button/Button'
import { useOBSConnection } from '../../hooks'
import { openExternalUrl } from '../../utils'
import { OBSSetupModal } from '../OBSSetupModal'

const OBS_DOWNLOAD_URL = 'https://obsproject.com/download'

export function ConnectObsStep({ number }: { number: number }) {
  const { t } = useTranslation('livestream')
  const { isConnected } = useOBSConnection()
  const [isSetupOpen, setIsSetupOpen] = useState(false)

  return (
    <GuideStep
      number={number}
      title={t('guide.obs.title')}
      isDone={isConnected}
    >
      <p>{t('guide.obs.install')}</p>
      <p>{t('guide.obs.connect')}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setIsSetupOpen(true)}>
          {t('guide.obs.openSetup')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openExternalUrl(OBS_DOWNLOAD_URL)}
        >
          {t('guide.obs.download')}
        </Button>
      </div>
      <OBSSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </GuideStep>
  )
}

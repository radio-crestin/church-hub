import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GuideStep } from './GuideStep'
import { Button } from '../../../../ui/button/Button'
import { MixerSetupModal } from '../MixerSetupModal'

export function MixerStep({ number }: { number: number }) {
  const { t } = useTranslation('livestream')
  const [isSetupOpen, setIsSetupOpen] = useState(false)

  return (
    <GuideStep number={number} title={t('guide.mixer.title')} isOptional>
      <p>{t('guide.mixer.description')}</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setIsSetupOpen(true)}
      >
        {t('guide.mixer.openSetup')}
      </Button>
      <MixerSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </GuideStep>
  )
}

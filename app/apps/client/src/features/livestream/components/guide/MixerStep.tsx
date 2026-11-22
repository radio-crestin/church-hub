import { useTranslation } from 'react-i18next'

import { GuideSettingsLink } from './GuideSettingsLink'
import { GuideStep } from './GuideStep'

interface MixerStepProps {
  number: number
  onNavigate: () => void
}

export function MixerStep({ number, onNavigate }: MixerStepProps) {
  const { t } = useTranslation('livestream')

  return (
    <GuideStep number={number} title={t('guide.mixer.title')} isOptional>
      <p>{t('guide.mixer.description')}</p>
      <GuideSettingsLink
        to="/livestream/mixer"
        label={t('guide.mixer.openSetup')}
        onNavigate={onNavigate}
      />
    </GuideStep>
  )
}

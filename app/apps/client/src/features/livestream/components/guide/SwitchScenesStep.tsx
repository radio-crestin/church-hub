import { useTranslation } from 'react-i18next'

import { GuideSettingsLink } from './GuideSettingsLink'
import { GuideStep } from './GuideStep'

interface SwitchScenesStepProps {
  number: number
  onNavigate: () => void
}

export function SwitchScenesStep({
  number,
  onNavigate,
}: SwitchScenesStepProps) {
  const { t } = useTranslation('livestream')

  return (
    <GuideStep number={number} title={t('guide.switching.title')}>
      <p>{t('guide.switching.click')}</p>
      <p>{t('guide.switching.automatic')}</p>
      <GuideSettingsLink
        to="/settings/livestream"
        label={t('guide.switching.openSettings')}
        onNavigate={onNavigate}
      />
    </GuideStep>
  )
}

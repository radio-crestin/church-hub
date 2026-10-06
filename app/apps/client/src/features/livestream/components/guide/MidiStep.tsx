import { useTranslation } from 'react-i18next'

import { GuideSettingsLink } from './GuideSettingsLink'
import { GuideStep } from './GuideStep'

interface MidiStepProps {
  number: number
  onNavigate: () => void
}

export function MidiStep({ number, onNavigate }: MidiStepProps) {
  const { t } = useTranslation('livestream')

  return (
    <GuideStep number={number} title={t('guide.midi.title')} isOptional>
      <p>{t('guide.midi.device')}</p>
      <p>{t('guide.midi.sceneShortcut')}</p>
      <GuideSettingsLink
        to="/settings/midi"
        label={t('guide.midi.openSettings')}
        onNavigate={onNavigate}
      />
    </GuideStep>
  )
}

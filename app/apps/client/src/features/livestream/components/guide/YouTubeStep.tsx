import { useTranslation } from 'react-i18next'

import { GuideSettingsLink } from './GuideSettingsLink'
import { GuideStep } from './GuideStep'
import { useYouTubeAuth, useYouTubeConfig } from '../../hooks'

interface YouTubeStepProps {
  number: number
  onNavigate: () => void
}

export function YouTubeStep({ number, onNavigate }: YouTubeStepProps) {
  const { t } = useTranslation('livestream')
  const { isAuthenticated } = useYouTubeAuth()
  const { config } = useYouTubeConfig()

  return (
    <GuideStep
      number={number}
      title={t('guide.youtube.title')}
      isDone={isAuthenticated}
    >
      <p>{t('guide.youtube.signIn')}</p>
      <p>{t('guide.youtube.start')}</p>
      {config?.startSceneName && config.stopSceneName && (
        <p>
          {t('guide.youtube.startStopScenes', {
            start: config.startSceneName,
            stop: config.stopSceneName,
          })}
        </p>
      )}
      <GuideSettingsLink
        to="/livestream/youtube"
        label={t('guide.youtube.openSettings')}
        onNavigate={onNavigate}
      />
    </GuideStep>
  )
}

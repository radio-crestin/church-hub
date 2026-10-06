import { useTranslation } from 'react-i18next'

import { GuideStep } from './GuideStep'
import { useYouTubeAuth, useYouTubeConfig } from '../../hooks'

export function YouTubeStep({ number }: { number: number }) {
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
    </GuideStep>
  )
}

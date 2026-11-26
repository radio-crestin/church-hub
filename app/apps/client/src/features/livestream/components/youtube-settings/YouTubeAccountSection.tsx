import { Youtube } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings/components/SettingsSection'
import { Button } from '~/ui/button/Button'
import { useYouTubeAuth } from '../../hooks'

/** The YouTube channel Church Hub streams to: connect or disconnect it. */
export function YouTubeAccountSection() {
  const { t } = useTranslation('livestream')
  const {
    isAuthenticated,
    channelName,
    login,
    logout,
    isLoggingOut,
    isAuthenticating,
  } = useYouTubeAuth()

  return (
    <SettingsSection
      title={t('youtubeSettings.account.title')}
      description={t('youtubeSettings.account.description')}
      icon={Youtube}
      testId="youtube-settings-account"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-body">
          {isAuthenticated
            ? t('youtubeSettings.account.connectedAs', {
                channel: channelName ?? '',
              })
            : t('youtubeSettings.account.notConnected')}
        </p>
        {isAuthenticated ? (
          <Button
            variant="secondary"
            onClick={() => logout()}
            disabled={isLoggingOut}
          >
            {t('youtube.logout')}
          </Button>
        ) : (
          <Button onClick={() => login()} disabled={isAuthenticating}>
            {isAuthenticating
              ? t('youtube.authenticating')
              : t('youtube.login')}
          </Button>
        )}
      </div>
    </SettingsSection>
  )
}

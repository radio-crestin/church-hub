import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useYouTubeAuth } from '../hooks'

export function YouTubeAuthStatus() {
  const { t } = useTranslation('livestream')
  const {
    isAuthenticated,
    channelName,
    login,
    logout,
    isLoggingOut,
    isLoading,
  } = useYouTubeAuth()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isAuthenticated ? 'bg-red-500' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isAuthenticated
            ? t('youtube.connected', { channelName })
            : t('youtube.notConnected')}
        </span>
      </div>

      {isAuthenticated ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          disabled={isLoggingOut}
        >
          {t('youtube.logout')}
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={login}>
          {t('youtube.login')}
        </Button>
      )}
    </div>
  )
}

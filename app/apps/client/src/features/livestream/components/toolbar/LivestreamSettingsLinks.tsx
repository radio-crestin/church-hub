import { Clapperboard, Monitor, SlidersHorizontal, Youtube } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsLinkButton } from './SettingsLinkButton'
import {
  useMixerConnectionStatus,
  useOBSConnection,
  useOBSScenes,
  useYouTubeAuth,
} from '../../hooks'

/** One button per settings page, each with the state of what it sets up. */
export function LivestreamSettingsLinks() {
  const { t } = useTranslation('livestream')
  const youtube = useYouTubeAuth()
  const obs = useOBSConnection()
  const mixer = useMixerConnectionStatus()
  const { scenes } = useOBSScenes()

  return (
    <nav
      aria-label={t('settingsPages.navLabel')}
      className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      <SettingsLinkButton
        to="/livestream/youtube"
        icon={Youtube}
        label={t('settingsPages.youtube.button')}
        testId="livestream-youtube-settings"
        tone={
          youtube.isAuthenticated
            ? 'ok'
            : youtube.isAuthenticating
              ? 'busy'
              : 'off'
        }
        status={
          youtube.isAuthenticated
            ? (youtube.channelName ?? t('settingsPages.status.connected'))
            : t('settingsPages.status.notConnected')
        }
      />
      <SettingsLinkButton
        to="/livestream/obs"
        icon={Monitor}
        label={t('settingsPages.obs.button')}
        testId="livestream-obs-settings"
        tone={obs.isConnected ? 'ok' : obs.isConnecting ? 'busy' : 'off'}
        status={
          obs.isConnected
            ? t('settingsPages.status.connected')
            : obs.isConnecting
              ? t('settingsPages.status.connecting')
              : t('settingsPages.status.notConnected')
        }
      />
      <SettingsLinkButton
        to="/livestream/mixer"
        icon={SlidersHorizontal}
        label={t('settingsPages.mixer.button')}
        testId="livestream-mixer-settings"
        tone={!mixer.isEnabled ? 'off' : mixer.isConnected ? 'ok' : 'error'}
        status={
          !mixer.isEnabled
            ? t('settingsPages.status.off')
            : mixer.isConnected
              ? t('settingsPages.status.connected')
              : t('settingsPages.status.notAnswering')
        }
      />
      <SettingsLinkButton
        to="/settings/livestream"
        icon={Clapperboard}
        label={t('settingsPages.scenes.button')}
        testId="livestream-scene-settings"
        tone={scenes.length ? 'ok' : 'off'}
        status={t('settingsPages.scenes.count', { count: scenes.length })}
      />
    </nav>
  )
}

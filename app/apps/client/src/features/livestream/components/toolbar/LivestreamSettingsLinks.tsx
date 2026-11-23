import {
  ChevronDown,
  Clapperboard,
  Monitor,
  Settings2,
  SlidersHorizontal,
  Youtube,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '~/hooks/useMediaQuery'
import {
  SettingsLinkButton,
  type SettingsLinkButtonProps,
  STATUS_DOT,
} from './SettingsLinkButton'
import {
  useMixerConnectionStatus,
  useOBSConnection,
  useOBSScenes,
  useYouTubeAuth,
} from '../../hooks'

type SettingsLink = SettingsLinkButtonProps & { short: string }

/**
 * One button per settings page, each with the state of what it sets up.
 * A phone keeps them folded under one row, so the scenes come first.
 */
export function LivestreamSettingsLinks() {
  const { t } = useTranslation('livestream')
  const youtube = useYouTubeAuth()
  const obs = useOBSConnection()
  const mixer = useMixerConnectionStatus()
  const { scenes } = useOBSScenes()
  const isPhone = !useMediaQuery('(min-width: 1024px)')
  const [isOpen, setIsOpen] = useState(false)

  const links: SettingsLink[] = [
    {
      to: '/livestream/youtube',
      icon: Youtube,
      label: t('settingsPages.youtube.button'),
      short: t('settingsPages.rail.youtube'),
      testId: 'livestream-youtube-settings',
      tone: youtube.isAuthenticated
        ? 'ok'
        : youtube.isAuthenticating
          ? 'busy'
          : 'off',
      status: youtube.isAuthenticated
        ? (youtube.channelName ?? t('settingsPages.status.connected'))
        : t('settingsPages.status.notConnected'),
    },
    {
      to: '/livestream/obs',
      icon: Monitor,
      label: t('settingsPages.obs.button'),
      short: t('settingsPages.rail.obs'),
      testId: 'livestream-obs-settings',
      tone: obs.isConnected ? 'ok' : obs.isConnecting ? 'busy' : 'off',
      status: obs.isConnected
        ? t('settingsPages.status.connected')
        : obs.isConnecting
          ? t('settingsPages.status.connecting')
          : t('settingsPages.status.notConnected'),
    },
    {
      to: '/livestream/mixer',
      icon: SlidersHorizontal,
      label: t('settingsPages.mixer.button'),
      short: t('settingsPages.rail.mixer'),
      testId: 'livestream-mixer-settings',
      tone: !mixer.isEnabled ? 'off' : mixer.isConnected ? 'ok' : 'error',
      status: !mixer.isEnabled
        ? t('settingsPages.status.off')
        : mixer.isConnected
          ? t('settingsPages.status.connected')
          : t('settingsPages.status.notAnswering'),
    },
    {
      to: '/settings/livestream',
      icon: Clapperboard,
      label: t('settingsPages.scenes.button'),
      short: t('settingsPages.rail.scenes'),
      testId: 'livestream-scene-settings',
      tone: scenes.length ? 'ok' : 'off',
      status: t('settingsPages.scenes.count', { count: scenes.length }),
    },
  ]

  const isShown = !isPhone || isOpen

  return (
    <nav aria-label={t('settingsPages.navLabel')} className="shrink-0">
      {isPhone && (
        <button
          type="button"
          data-testid="livestream-settings-toggle"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left dark:border-gray-700 dark:bg-gray-800"
        >
          <Settings2
            className="h-5 w-5 shrink-0 text-gray-600 dark:text-gray-300"
            aria-hidden
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {t('settingsPages.railGroup')}
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2.5 overflow-hidden text-xs text-gray-500 dark:text-gray-400">
            {links.map((link) => (
              <span key={link.to} className="flex shrink-0 items-center gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${STATUS_DOT[link.tone]}`}
                  aria-hidden
                />
                {link.short}
              </span>
            ))}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      )}
      {isShown && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-0 xl:grid-cols-4">
          {links.map(({ short: _short, ...link }) => (
            <SettingsLinkButton key={link.to} {...link} />
          ))}
        </div>
      )}
    </nav>
  )
}

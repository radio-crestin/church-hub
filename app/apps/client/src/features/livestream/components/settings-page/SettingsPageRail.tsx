import { Clapperboard, Monitor, SlidersHorizontal, Youtube } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsNavItem } from '~/features/settings'

/**
 * The rail of a livestream settings page, like the app settings' one: the
 * settings pages, the open one highlighted.
 */
export function SettingsPageRail() {
  const { t } = useTranslation('livestream')

  return (
    <nav
      aria-label={t('settingsPages.navLabel')}
      className="space-y-3 pt-1"
      data-testid="livestream-settings-rail"
    >
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {t('settingsPages.railGroup')}
      </div>
      <div className="mt-0.5 space-y-0.5">
        <SettingsNavItem
          to="/livestream/youtube"
          icon={Youtube}
          label={t('settingsPages.rail.youtube')}
        />
        <SettingsNavItem
          to="/livestream/obs"
          icon={Monitor}
          label={t('settingsPages.rail.obs')}
        />
        <SettingsNavItem
          to="/livestream/mixer"
          icon={SlidersHorizontal}
          label={t('settingsPages.rail.mixer')}
        />
        <SettingsNavItem
          to="/settings/livestream"
          icon={Clapperboard}
          label={t('settingsPages.rail.scenes')}
        />
      </div>
    </nav>
  )
}

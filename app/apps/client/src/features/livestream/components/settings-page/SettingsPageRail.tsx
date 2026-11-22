import { Clapperboard, Monitor, SlidersHorizontal, Youtube } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SettingsNavItem,
  SettingsNavItemContent,
  settingsNavItemClass,
} from '~/features/settings'
import type { SettingsPageSection } from './settingsPageSection'

interface SettingsPageRailProps {
  sections: SettingsPageSection[]
  activeSection?: string
  onPickSection: (id: string) => void
}

function RailGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-0.5 space-y-0.5">{children}</div>
    </div>
  )
}

/**
 * The rail of a livestream settings page, like the app settings' one: the
 * settings pages, then the sections of the open page.
 */
export function SettingsPageRail({
  sections,
  activeSection,
  onPickSection,
}: SettingsPageRailProps) {
  const { t } = useTranslation('livestream')

  return (
    <nav
      aria-label={t('settingsPages.navLabel')}
      className="space-y-3 pt-1"
      data-testid="livestream-settings-rail"
    >
      <RailGroup label={t('settingsPages.groups.pages')}>
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
      </RailGroup>
      {sections.length > 0 && (
        <RailGroup label={t('settingsPages.groups.sections')}>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-testid={`rail-${section.id}`}
              aria-current={section.id === activeSection ? 'true' : undefined}
              className={settingsNavItemClass(section.id === activeSection)}
              onClick={() => onPickSection(section.id)}
            >
              <SettingsNavItemContent
                icon={section.icon}
                label={section.label}
                isActive={section.id === activeSection}
              />
            </button>
          ))}
        </RailGroup>
      )}
    </nav>
  )
}

import { Link, useLocation } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSidebarItemClick } from '../sidebar/use-sidebar-item-click'
import { useSidebarMenuItems } from '../sidebar/use-sidebar-menu-items'

/** The pages that get a tab, in tab order; the rest are under "More". */
const TAB_ITEM_IDS = ['songs', 'bible', 'schedules', 'present']

/** A tab's label where the sidebar's is too long for a fifth of a phone. */
const SHORT_LABEL_KEYS: Record<string, string> = {
  present: 'sidebar:tabs.present',
}

interface MobileTabBarProps {
  /** Opens the full menu (every other page, settings, the account). */
  onOpenMore: () => void
}

/**
 * The phone's main navigation, at the bottom where the thumb is: the pages
 * used during a service as tabs, and "More" for the rest. Pages hidden in the
 * sidebar configuration or not permitted for this user get no tab.
 */
export function MobileTabBar({ onOpenMore }: MobileTabBarProps) {
  const { t } = useTranslation('sidebar')
  const location = useLocation()
  const menuItems = useSidebarMenuItems()
  const handleItemClick = useSidebarItemClick()

  const tabs = TAB_ITEM_IDS.flatMap((id) => {
    const item = menuItems.find((menuItem) => menuItem.id === id)
    return item ? [item] : []
  })

  const tabClass = (isActive: boolean) =>
    `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
      isActive ? 'text-fg' : 'text-fg-hint'
    }`

  return (
    <nav
      data-testid="mobile-tab-bar"
      className="flex h-14 bg-panel border-t border-line"
    >
      {tabs.map((item) => {
        const isActive =
          location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.id}
            to={item.to}
            data-testid={`mobile-tab-${item.id}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={(e) => handleItemClick(item.to, e)}
            className={tabClass(isActive)}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="truncate max-w-full px-1">
              {SHORT_LABEL_KEYS[item.id]
                ? t(SHORT_LABEL_KEYS[item.id])
                : item.label}
            </span>
          </Link>
        )
      })}
      <button
        type="button"
        data-testid="mobile-tab-more"
        onClick={onOpenMore}
        className={tabClass(false)}
      >
        <Menu size={20} strokeWidth={1.5} />
        <span>{t('tabs.more')}</span>
      </button>
    </nav>
  )
}

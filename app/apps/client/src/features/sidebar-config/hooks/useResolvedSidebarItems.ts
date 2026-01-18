import {
  Bell,
  Bookmark,
  Calendar,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  Grid,
  Heart,
  Home,
  Image,
  Layers,
  Link,
  List,
  type LucideIcon,
  Mail,
  Map,
  MessageSquare,
  Phone,
  Search,
  Star,
  Users,
  Video,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BUILTIN_ITEMS, ICON_COLOR_HEX } from '../constants'
import { getCustomPagePermission } from '../service/sidebarConfig'
import type { IconColor, ResolvedMenuItem, SidebarMenuItem } from '../types'

/**
 * Map of icon names to Lucide icon components
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  Link,
  ExternalLink,
  FileText,
  Video,
  Image,
  Bookmark,
  Star,
  Heart,
  Home,
  Users,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Map,
  Compass,
  Search,
  Clock,
  Bell,
  Layers,
  Grid,
  List,
  Folder,
}

/**
 * Hook that resolves sidebar menu items to renderable format
 * Merges configuration with static definitions and translations
 */
export function useResolvedSidebarItems(
  items: SidebarMenuItem[] | undefined,
): ResolvedMenuItem[] {
  const { t } = useTranslation()

  return useMemo((): ResolvedMenuItem[] => {
    if (!items) {
      return []
    }

    const result: ResolvedMenuItem[] = []

    for (const item of items
      .filter((i) => i.isVisible)
      .sort((a, b) => a.order - b.order)) {
      if (item.type === 'builtin') {
        const definition = BUILTIN_ITEMS[item.builtinId]
        if (!definition) {
          continue
        }

        result.push({
          id: item.id,
          icon: definition.icon,
          label: t(definition.labelKey),
          to: definition.to,
          permission: definition.permission,
          isCustom: false,
        })
      } else {
        // Custom page
        const IconComponent = ICON_MAP[item.iconName] ?? Globe
        // Use customIconUrl if iconSource is 'favicon', otherwise undefined
        const customIconUrl =
          item.iconSource === 'favicon' ? item.customIconUrl : undefined

        // Compute favicon background color (priority order):
        // 1. customIconBgColor - user's custom hex color
        // 2. iconColor - predefined color from settings
        // 3. faviconColor - extracted color from the favicon
        const customBgColor = item.settings?.customIconBgColor
        const iconColor = item.settings?.iconColor as IconColor | undefined
        const faviconBgColor = customIconUrl
          ? (customBgColor ??
            (iconColor ? ICON_COLOR_HEX[iconColor] : item.faviconColor))
          : undefined

        result.push({
          id: item.id,
          icon: IconComponent,
          label: item.title,
          to: `/custom-page/${item.id}`,
          permission: getCustomPagePermission(item.id),
          isCustom: true,
          customIconUrl,
          faviconBgColor,
        })
      }
    }

    return result
  }, [items, t])
}

/**
 * Gets the icon component for a given icon name
 */
export function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Globe
}

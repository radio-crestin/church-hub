import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BUILTIN_ITEMS } from '~/features/sidebar-config/constants'
import { useSidebarConfig } from '~/features/sidebar-config/hooks/useSidebarConfig'
import { getCustomPagePermission } from '~/features/sidebar-config/service/sidebarConfig'
import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { useShortcutPermissionCheck } from './useShortcutPermissionCheck'

export interface ShortcutPage {
  /** The sidebar item's id. */
  itemId: string
  /** Set for built-in pages. */
  builtinId?: BuiltInMenuItemId
  label: string
}

/**
 * Every sidebar page whose shortcuts the user may set, in sidebar order —
 * hidden ones too, since their shortcuts still work. Pages the user may not
 * view are left out, the same as their shortcuts are.
 */
export function useShortcutPages(): ShortcutPage[] {
  const { t } = useTranslation('sidebar')
  const { config } = useSidebarConfig()
  const canUse = useShortcutPermissionCheck()

  return useMemo(() => {
    if (!config) return []

    const pages: ShortcutPage[] = []
    for (const item of [...config.items].sort((a, b) => a.order - b.order)) {
      if (item.type === 'builtin') {
        const definition = BUILTIN_ITEMS[item.builtinId]
        if (!definition || !canUse(definition.permission)) continue
        pages.push({
          itemId: item.id,
          builtinId: item.builtinId,
          label: t(definition.labelKey),
        })
      } else {
        if (!canUse(getCustomPagePermission(item.id))) continue
        pages.push({ itemId: item.id, label: item.title })
      }
    }
    return pages
  }, [config, canUse, t])
}

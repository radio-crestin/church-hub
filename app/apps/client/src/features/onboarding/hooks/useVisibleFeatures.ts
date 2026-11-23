import { useSidebarConfig } from '~/features/sidebar-config/hooks/useSidebarConfig'
import type { BuiltInMenuItemId } from '~/features/sidebar-config/types'
import { ONBOARDING_FEATURES } from '../constants'

/** The offered pages the side menu shows now, or null while it loads. */
export function useVisibleFeatures(): Set<BuiltInMenuItemId> | null {
  const { config } = useSidebarConfig()
  if (!config) return null
  const hidden = new Set<BuiltInMenuItemId>()
  for (const item of config.items) {
    if (item.type === 'builtin' && !item.isVisible) hidden.add(item.builtinId)
  }
  return new Set(ONBOARDING_FEATURES.filter((id) => !hidden.has(id)))
}

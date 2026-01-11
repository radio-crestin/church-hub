import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { isTauri } from '~/utils/isTauri'
import { createLogger } from '~/utils/logger'
import { useSidebarConfig } from './useSidebarConfig'
import { BUILTIN_ITEMS } from '../constants'
import { openPageInNativeWindow } from '../service/pageWindowManager'
import type {
  BuiltInMenuItem,
  CustomPageMenuItem,
  SidebarMenuItem,
} from '../types'

const logger = createLogger('app:pageWindow')

/**
 * Delay between opening windows (ms)
 * Prevents overwhelming the system with simultaneous window creation
 */
const WINDOW_OPEN_DELAY = 300

/**
 * Session storage key to track if auto-open has run this session
 * This prevents re-running auto-open if the component remounts
 */
const AUTO_OPEN_SESSION_KEY = 'sidebar-page-windows-auto-opened'

/**
 * Opens all pages configured to auto-open in native windows on startup
 */
async function openAutoOpenPages(
  items: SidebarMenuItem[],
  t: (key: string) => string,
): Promise<void> {
  const pagesToOpen = items.filter(
    (item) =>
      item.isVisible && item.settings?.nativeWindow?.autoOpenOnStartup === true,
  )

  if (pagesToOpen.length === 0) {
    return
  }

  logger.debug(`Opening ${pagesToOpen.length} page(s) in native windows`)

  for (let i = 0; i < pagesToOpen.length; i++) {
    const item = pagesToOpen[i]

    // Get page info
    let pageLabel: string
    let pageRoute: string
    let iconName: string | undefined
    let externalUrl: string | undefined

    if (item.type === 'builtin') {
      const builtinItem = item as BuiltInMenuItem
      const definition = BUILTIN_ITEMS[builtinItem.builtinId]
      if (!definition) {
        logger.warn(`Unknown builtin: ${builtinItem.builtinId}`)
        continue
      }
      pageLabel = t(definition.labelKey)
      pageRoute = definition.to
      // Built-in items use the icon from their definition
      iconName = definition.id.charAt(0).toUpperCase() + definition.id.slice(1)
      externalUrl = undefined // Built-in pages use app routes
    } else {
      const customItem = item as CustomPageMenuItem
      pageLabel = customItem.title
      pageRoute = `/custom-page/${customItem.id}`
      iconName = customItem.iconName
      // Custom pages load external URL directly in native window
      externalUrl = customItem.url
    }

    try {
      await openPageInNativeWindow(
        item.id,
        pageLabel,
        pageRoute,
        iconName,
        externalUrl,
      )
    } catch (error) {
      logger.error(`Failed to open page ${item.id}:`, error)
    }

    // Add delay between windows (except for the last one)
    if (i < pagesToOpen.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, WINDOW_OPEN_DELAY))
    }
  }
}

/**
 * Checks if auto-open has already run this session
 */
function hasAutoOpenedThisSession(): boolean {
  try {
    return sessionStorage.getItem(AUTO_OPEN_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Marks auto-open as complete for this session
 */
function markAutoOpenComplete(): void {
  try {
    sessionStorage.setItem(AUTO_OPEN_SESSION_KEY, 'true')
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook that automatically opens all pages configured for native windows on app startup
 * Only runs once per session when sidebar config is first loaded
 * Uses sessionStorage to prevent re-running on component remounts
 */
export function useAutoOpenPageWindows(): void {
  const { config, isLoading } = useSidebarConfig()
  const { t } = useTranslation()
  const hasOpenedRef = useRef(false)

  useEffect(() => {
    // Only run once, only in Tauri, and only after config is loaded
    if (hasOpenedRef.current || isLoading || !config || !isTauri()) {
      return
    }

    // Check sessionStorage to prevent re-running on remounts
    if (hasAutoOpenedThisSession()) {
      logger.debug('Auto-open already completed this session, skipping')
      hasOpenedRef.current = true
      return
    }

    hasOpenedRef.current = true
    markAutoOpenComplete()

    logger.debug('Running auto-open for page windows')

    // Open all pages configured for auto-open
    openAutoOpenPages(config.items, t).catch((error) => {
      logger.error('Failed to auto-open pages:', error)
    })
  }, [config, isLoading, t])
}

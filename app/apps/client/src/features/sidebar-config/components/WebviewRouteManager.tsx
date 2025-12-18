import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { isTauri } from '~/features/presentation/utils/openDisplayWindow'

import { hideAllCustomPageWebviews } from '../service/webviewManager'

/**
 * Extracts the page ID from a custom page path
 */
function extractPageId(path: string): string | null {
  const match = path.match(/^\/custom-page\/(.+)$/)
  return match ? match[1] : null
}

/**
 * Component that manages webview visibility based on route changes
 * Closes webviews when navigating away from custom pages
 * This component should be mounted near the root of the app
 */
export function WebviewRouteManager() {
  const location = useLocation()
  const [isInTauri] = useState(() => isTauri())
  const previousPath = useRef<string>(location.pathname)

  useEffect(() => {
    if (!isInTauri) return

    const currentPath = location.pathname
    const previousPageId = extractPageId(previousPath.current)
    const currentPageId = extractPageId(currentPath)

    const wasOnCustomPage = previousPageId !== null
    const isOnCustomPage = currentPageId !== null

    // If we left a custom page entirely, hide all webviews
    if (wasOnCustomPage && !isOnCustomPage) {
      console.log('[WebviewRouteManager] Left custom page, hiding all webviews')
      void hideAllCustomPageWebviews()
    }

    // If we switched from one custom page to another, close the old webview
    // (the new page will show its own webview)
    if (wasOnCustomPage && isOnCustomPage && previousPageId !== currentPageId) {
      console.log(
        '[WebviewRouteManager] Switching custom pages:',
        previousPageId,
        '->',
        currentPageId,
      )
      // The new CustomPageView will create its own webview and close the old one
      // We don't need to close here as showCustomPageWebview handles it
    }

    previousPath.current = currentPath
  }, [location.pathname, isInTauri])

  // This component doesn't render anything
  return null
}

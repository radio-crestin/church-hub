import { useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useKioskSettings } from '../../features/kiosk'
import { usePresentationState } from '../../features/presentation'
import { hideAllCustomPageWebviews } from '../../features/sidebar-config'

/**
 * What a click on a page link in the sidebar (or the phone's tab bar) does on
 * top of following the link: custom page webviews are hidden, Biblia opens at
 * the verse on the screens, and kiosk opens its configured startup page.
 */
export function useSidebarItemClick() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: kioskSettings } = useKioskSettings()
  const { data: presentationState } = usePresentationState()

  return useCallback(
    (destinationPath: string, e?: React.MouseEvent<HTMLAnchorElement>) => {
      // If navigating to a non-custom-page, hide ALL custom page webviews
      if (!destinationPath.startsWith('/custom-page/')) {
        void hideAllCustomPageWebviews()
      }

      // Handle Bible navigation - go to currently displayed verse if available
      // But only if not currently viewing search results (URL has ?q= param)
      if (destinationPath === '/bible') {
        const hasSearchQuery =
          'q' in (location.search as Record<string, unknown>)
        const tempContent = presentationState?.temporaryContent
        if (
          !hasSearchQuery &&
          tempContent?.type === 'bible' &&
          !presentationState?.isHidden
        ) {
          e?.preventDefault()
          const { bookId, bookName, chapter, currentVerseIndex } =
            tempContent.data
          navigate({
            to: '/bible',
            search: {
              book: bookId,
              bookName: bookName,
              chapter: chapter,
              verse: currentVerseIndex + 1, // Convert 0-based index to 1-based verse
            },
          })
          return
        }
      }

      // Handle kiosk navigation - go to configured startup page instead of /kiosk
      if (destinationPath === '/kiosk' && kioskSettings?.enabled) {
        e?.preventDefault()
        const { startupPage } = kioskSettings
        if (startupPage.type === 'screen') {
          navigate({ to: `/screen/${startupPage.screenId}` })
        } else {
          navigate({ to: startupPage.path })
        }
      }
    },
    [kioskSettings, navigate, presentationState, location.search],
  )
}

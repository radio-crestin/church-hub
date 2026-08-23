import { useEffect } from 'react'

import type {
  BuiltInMenuItemId,
  PageShortcutAction,
} from '~/features/sidebar-config/types'

/**
 * How a page-scoped shortcut reaches the page it belongs to. The shortcut
 * manager resolves the key against the open route and raises this event; the
 * page that is mounted acts on it with whatever "the selected slide" means
 * there (a song slide, a verse).
 */
const PAGE_SHORTCUT_EVENT = 'page-shortcut'

interface PageShortcutDetail {
  pageId: BuiltInMenuItemId
  action: PageShortcutAction
}

export function emitPageShortcutEvent(
  pageId: BuiltInMenuItemId,
  action: PageShortcutAction,
) {
  window.dispatchEvent(
    new CustomEvent<PageShortcutDetail>(PAGE_SHORTCUT_EVENT, {
      detail: { pageId, action },
    }),
  )
}

export function usePageShortcutEvent(
  pageId: BuiltInMenuItemId,
  action: PageShortcutAction,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const listener = (event: Event) => {
      const { detail } = event as CustomEvent<PageShortcutDetail>
      if (detail.pageId === pageId && detail.action === action) handler()
    }
    window.addEventListener(PAGE_SHORTCUT_EVENT, listener)
    return () => window.removeEventListener(PAGE_SHORTCUT_EVENT, listener)
  }, [pageId, action, handler, enabled])
}

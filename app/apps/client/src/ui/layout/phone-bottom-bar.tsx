import { createContext, type ReactNode, useContext } from 'react'
import { createPortal } from 'react-dom'

/** Where the phone layout puts a page's own bottom bar (see PhoneBottomBar). */
export const PhoneBottomBarSlotContext = createContext<HTMLElement | null>(null)

/**
 * A page's own controls at the bottom of a phone screen, under the thumb, in
 * place of the live strip (the page's previous, hide and next), on screens
 * narrower than Tailwind's `lg`, where pages take their phone layout. A page
 * the tab bar leads to (the Bible) keeps the tab bar under its controls; one
 * opened from a page (a song) takes the tab bar's place too.
 */
export function PhoneBottomBar({
  children,
  keepsTabBar = false,
}: {
  children: ReactNode
  keepsTabBar?: boolean
}) {
  const slot = useContext(PhoneBottomBarSlotContext)
  if (!slot) return null
  return createPortal(
    <div
      data-phone-bottom-bar=""
      data-replaces-tab-bar={keepsTabBar ? undefined : ''}
      className="lg:hidden"
    >
      {children}
    </div>,
    slot,
  )
}

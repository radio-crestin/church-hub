import { createContext, type ReactNode, useContext } from 'react'
import { createPortal } from 'react-dom'

/** Where the phone layout puts a page's own bottom bar (see PhoneBottomBar). */
export const PhoneBottomBarSlotContext = createContext<HTMLElement | null>(null)

/**
 * A page's own controls at the bottom of a phone screen, under the thumb, in
 * place of the tab bar and the live strip (the song page's previous, hide and
 * next), on screens narrower than Tailwind's `lg`, where pages take their
 * phone layout.
 */
export function PhoneBottomBar({ children }: { children: ReactNode }) {
  const slot = useContext(PhoneBottomBarSlotContext)
  if (!slot) return null
  return createPortal(
    <div data-phone-bottom-bar="" className="lg:hidden">
      {children}
    </div>,
    slot,
  )
}

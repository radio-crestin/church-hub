import { type RefObject, useEffect, useState } from 'react'

import type { SettingsPageSection } from './settingsPageSection'

/**
 * The section at the top of the scrolling pane (the last one whose top has
 * passed its upper quarter), so the rail shows where the operator is.
 */
export function useActiveSection(
  pane: RefObject<HTMLElement | null>,
  sections: SettingsPageSection[],
): string | undefined {
  const [active, setActive] = useState<string | undefined>(sections[0]?.id)
  const ids = sections.map((s) => s.id).join(',')

  useEffect(() => {
    const element = pane.current
    if (!element || !ids) return
    const list = ids.split(',')
    const update = () => {
      const limit =
        element.getBoundingClientRect().top + element.clientHeight / 4
      let current: string | undefined = list[0]
      for (const id of list) {
        const card = element.querySelector(`[data-testid="${id}"]`)
        if (card && card.getBoundingClientRect().top <= limit) current = id
      }
      // Scrolled to the end: the last section, however short.
      const scrollable = element.scrollHeight > element.clientHeight + 2
      if (
        scrollable &&
        element.scrollTop + element.clientHeight >= element.scrollHeight - 2
      ) {
        current = list.at(-1)
      }
      setActive(current)
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    return () => element.removeEventListener('scroll', update)
  }, [pane, ids])

  return active
}

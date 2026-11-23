import { getCurrentFeature, getCurrentRoute } from './currentRoute'
import type { ClientEventProperties } from '../analyticsEvents'

/** What counts as a press: buttons, links, menu items, tabs, switches. */
export const PRESSABLE_SELECTOR = [
  'button',
  'a[href]',
  'summary',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="button"]',
  'input[type="submit"]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="option"]',
].join(',')

/**
 * A test id with its numbers taken out (`schedule-sub-item-12` →
 * `schedule-sub-item-#`): the kind of element, not which one.
 */
function testIdOf(element: Element | null): string | undefined {
  const id = element?.getAttribute('data-testid')
  return id ? id.replace(/\d+/g, '#').slice(0, 80) : undefined
}

/** The Lucide icon drawn in the element (`trash-2`), if it has one. */
function iconOf(element: Element): string | undefined {
  const svg = element.querySelector('svg[class*="lucide-"]')
  const name = svg
    ? Array.from(svg.classList).find(
        (c) => c.startsWith('lucide-') && c !== 'lucide-icon',
      )
    : undefined
  return name?.slice('lucide-'.length)
}

/**
 * Describes a pressed element without any of its text: its own test id (or
 * `data-analytics` name), the nearest test id around it, its role, its icon
 * and the page. Labels and text are never read: they can hold song lyrics,
 * names, file names or addresses.
 */
export function describePressedElement(
  element: Element,
): ClientEventProperties<'button_pressed'> {
  const named = element.getAttribute('data-analytics') ?? undefined
  return {
    element: named ?? testIdOf(element),
    container: testIdOf(
      element.parentElement?.closest('[data-testid]') ?? null,
    ),
    role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
    icon: iconOf(element),
    feature: getCurrentFeature(),
    route: getCurrentRoute(),
  }
}

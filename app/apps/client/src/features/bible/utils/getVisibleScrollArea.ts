/**
 * The part of a scroll box the reader actually sees: its own rect, less a
 * header pinned over its top (`data-sticky-header`, the phone's preview and
 * tabs), which would otherwise hide a verse scrolled to the top or centre.
 */
export function getVisibleScrollArea(scroller: HTMLElement) {
  const rect = scroller.getBoundingClientRect()
  const header = scroller.querySelector<HTMLElement>('[data-sticky-header]')
  const top = Math.max(rect.top, header?.getBoundingClientRect().bottom ?? 0)
  return { top, bottom: rect.bottom, height: rect.bottom - top }
}

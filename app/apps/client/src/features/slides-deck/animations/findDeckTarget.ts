/**
 * The node an animation moves: an element's animated body, or the
 * `paragraphIndex`-th paragraph of its text, counting each list item as a
 * paragraph, as PowerPoint counts bullets.
 */
export function findDeckTarget(
  root: HTMLElement,
  elementId: string,
  paragraphIndex?: number,
): HTMLElement | null {
  const id = CSS.escape(elementId)
  if (paragraphIndex == null) {
    return root.querySelector<HTMLElement>(`[data-deck-target="${id}"]`)
  }
  const text = root.querySelector<HTMLElement>(`[data-deck-text="${id}"]`)
  const paragraphs = text?.querySelectorAll<HTMLElement>(
    ':scope > :not(ul):not(ol), :scope > ul > li, :scope > ol > li',
  )
  return paragraphs?.[paragraphIndex] ?? null
}

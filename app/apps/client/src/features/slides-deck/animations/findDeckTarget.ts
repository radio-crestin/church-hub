/**
 * The node an animation moves: an element's animated body, or the
 * `paragraphIndex`-th paragraph of its text.
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
  return (text?.children[paragraphIndex] as HTMLElement | undefined) ?? null
}

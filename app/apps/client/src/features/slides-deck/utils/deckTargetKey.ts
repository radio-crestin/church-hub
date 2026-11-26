/** What an animation moves: a whole element, or one paragraph of a text box. */
export function deckTargetKey(
  elementId: string,
  paragraphIndex?: number,
): string {
  return paragraphIndex == null
    ? elementId
    : `${elementId}\u0000${paragraphIndex}`
}

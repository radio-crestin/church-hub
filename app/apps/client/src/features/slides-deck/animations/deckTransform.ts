/** The one transform form every pose uses, so they interpolate. */
export function deckTransform(
  dx: number,
  dy: number,
  scale: number,
  rotate: number,
): string {
  return `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${rotate}deg)`
}

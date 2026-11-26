/**
 * Puts `will-change` on an element only while its animation runs, so the
 * browser composites it on its own layer without a hand-off mid-flight, and
 * drops it afterwards: a lasting layer on every word would cost GPU memory.
 */
export function promoteWhileAnimating(
  element: HTMLElement,
  animation: Animation,
  property: 'opacity' | 'transform',
): void {
  const promoted = new Set(element.style.willChange.split(/,\s*/))
  promoted.delete('')
  promoted.add(property)
  element.style.willChange = [...promoted].join(', ')
  const release = () => {
    if (element.getAnimations().length === 0) element.style.willChange = ''
  }
  animation.addEventListener('finish', release)
  animation.addEventListener('cancel', release)
}

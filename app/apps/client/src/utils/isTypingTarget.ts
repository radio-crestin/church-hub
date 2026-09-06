/**
 * Whether keystrokes aimed at this element are text being typed — an input,
 * a textarea, a select or a contenteditable — and must not be taken away from
 * it by moving focus elsewhere.
 */
export function isTypingTarget(element: Element | null): boolean {
  if (!element) return false
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return true
  }
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  // Some DOM implementations (jsdom) do not compute isContentEditable.
  const attribute = element.getAttribute('contenteditable')
  return (
    attribute === '' || attribute === 'true' || attribute === 'plaintext-only'
  )
}

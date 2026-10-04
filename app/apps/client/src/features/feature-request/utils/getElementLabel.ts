const MAX_LABEL_LENGTH = 80

/** A short name for the element: aria-label, title, test id, text, or its tag. */
export function getElementLabel(element: Element): string {
  const text =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('data-testid') ||
    (element as HTMLElement).innerText ||
    element.tagName.toLowerCase()
  const singleLine = text.replace(/\s+/g, ' ').trim()
  return singleLine.length > MAX_LABEL_LENGTH
    ? `${singleLine.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : singleLine
}

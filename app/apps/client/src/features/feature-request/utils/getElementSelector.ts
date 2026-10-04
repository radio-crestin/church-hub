/**
 * Builds a CSS selector that matches exactly this element. It walks up
 * with `tag:nth-of-type(n)` steps and stops early at the nearest ancestor
 * that has a unique id or `data-testid`, which keeps the selector short and
 * stable across unrelated layout changes.
 */
export function getElementSelector(element: Element): string {
  const steps: string[] = []
  let current: Element | null = element

  while (current && current !== document.documentElement) {
    const anchor = getUniqueAnchor(current)
    if (anchor) {
      steps.unshift(anchor)
      return steps.join(' > ')
    }
    steps.unshift(getNthOfTypeStep(current))
    current = current.parentElement
  }
  return steps.join(' > ')
}

function getUniqueAnchor(element: Element): string | null {
  const candidates = [
    element.id ? `#${CSS.escape(element.id)}` : null,
    element.getAttribute('data-testid')
      ? `[data-testid="${CSS.escape(element.getAttribute('data-testid') ?? '')}"]`
      : null,
  ]
  for (const candidate of candidates) {
    if (candidate && document.querySelectorAll(candidate).length === 1) {
      return candidate
    }
  }
  return null
}

function getNthOfTypeStep(element: Element): string {
  const tag = element.tagName.toLowerCase()
  if (tag === 'body') return tag
  const sameTypeSiblings = Array.from(
    element.parentElement?.children ?? [],
  ).filter((sibling) => sibling.tagName === element.tagName)
  return `${tag}:nth-of-type(${sameTypeSiblings.indexOf(element) + 1})`
}

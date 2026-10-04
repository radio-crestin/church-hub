const MAX_CLASSES_PER_STEP = 2
const MAX_PATH_LENGTH = 2000

/**
 * Readable DOM path from <body> to the element, for a human reading the
 * issue: `body > div#root > aside > button[data-testid="x"].flex`. Tailwind
 * variant classes (`md:flex`, `w-[3px]`) are left out as noise.
 */
export function getElementPath(element: Element): string {
  const steps: string[] = []
  let current: Element | null = element

  while (current && current !== document.documentElement) {
    steps.unshift(describeStep(current))
    current = current.parentElement
  }
  const path = steps.join(' > ')
  return path.length > MAX_PATH_LENGTH
    ? `… ${path.slice(-(MAX_PATH_LENGTH - 2))}`
    : path
}

function describeStep(element: Element): string {
  let step = element.tagName.toLowerCase()
  if (element.id) step += `#${element.id}`
  const testId = element.getAttribute('data-testid')
  if (testId) step += `[data-testid="${testId}"]`
  const classes = Array.from(element.classList)
    .filter((name) => /^[a-zA-Z][\w-]*$/.test(name))
    .slice(0, MAX_CLASSES_PER_STEP)
  if (classes.length > 0) step += `.${classes.join('.')}`
  return step
}

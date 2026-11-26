const PANEL_SELECTOR = '[data-testid="settings-panel"]'
const WAIT_MS = 3000
const HIGHLIGHT_MS = 2500
const HIGHLIGHT_CLASSES = ['rounded', 'bg-selected', 'ring-1', 'ring-focus']

/** The first element in the settings panel whose own text is `label`. */
function findLabel(label: string): HTMLElement | null {
  const panel = document.querySelector(PANEL_SELECTOR)
  if (!panel) return null
  const wanted = label.trim().toLowerCase()
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim().toLowerCase() === wanted) {
      return node.parentElement
    }
  }
  return null
}

/**
 * Scrolls the settings panel to the setting labelled `label` and highlights it
 * for a moment. The page may still be loading its data, so it waits for the
 * label to appear; a setting hidden in a closed <details> is opened first.
 */
export function highlightSetting(label: string) {
  const started = Date.now()
  const tryHighlight = () => {
    const element = findLabel(label)
    if (!element) {
      if (Date.now() - started < WAIT_MS) setTimeout(tryHighlight, 100)
      return
    }
    const details = element.closest('details')
    if (details && !details.open) details.open = true
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    element.classList.add(...HIGHLIGHT_CLASSES)
    element.setAttribute('data-search-highlight', '')
    setTimeout(() => {
      element.classList.remove(...HIGHLIGHT_CLASSES)
      element.removeAttribute('data-search-highlight')
    }, HIGHLIGHT_MS)
  }
  tryHighlight()
}

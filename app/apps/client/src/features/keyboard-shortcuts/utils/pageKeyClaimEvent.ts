/**
 * How a sidebar key yields to the open page. Before a sidebar shortcut
 * navigates, it offers its key to the page on screen; a page that gives the
 * key its own meaning (F5 presents the selected slide on a song) claims it,
 * and the sidebar shortcut does nothing.
 */
const PAGE_KEY_CLAIM_EVENT = 'page-key-claim'

interface PageKeyClaimDetail {
  /** The key as configured, e.g. "F5". */
  shortcut: string
}

/** Offers the key to the open page; returns whether the page took it. */
export function offerKeyToPage(shortcut: string): boolean {
  const event = new CustomEvent<PageKeyClaimDetail>(PAGE_KEY_CLAIM_EVENT, {
    detail: { shortcut },
    cancelable: true,
  })
  return !window.dispatchEvent(event)
}

/**
 * Listens for offered keys. `onKey` returns whether it took the key.
 * Returns the unsubscribe.
 */
export function listenForPageKeyClaims(
  onKey: (shortcut: string) => boolean,
): () => void {
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<PageKeyClaimDetail>
    if (onKey(detail.shortcut)) event.preventDefault()
  }
  window.addEventListener(PAGE_KEY_CLAIM_EVENT, listener)
  return () => window.removeEventListener(PAGE_KEY_CLAIM_EVENT, listener)
}

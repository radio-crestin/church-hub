/** Where a screen link's device finds the screen (T-214). */
export interface ScreenLinkTarget {
  /** The signaling relay. */
  relay: string
  /** The phone's room: it hosts the screen while the PC is off. */
  room: string
  /** The church PC's room, preferred when it answers. */
  pcRoom: string | null
  /** The link's token: what the device signs in with. */
  token: string
  screenId: number
}

/**
 * The link another device opens: the web app's screen page, with where to
 * reach it in the fragment (never sent to a server).
 */
export function buildScreenLinkUrl(origin: string, target: ScreenLinkTarget) {
  const fragment = new URLSearchParams({
    r: target.relay,
    h: target.room,
    g: target.token,
  })
  if (target.pcRoom) fragment.set('p', target.pcRoom)
  return `${origin}/screen/${target.screenId}#${fragment}`
}

/** The screen link this page was opened with, or null. */
export function parseScreenLinkUrl(url: URL): ScreenLinkTarget | null {
  const screen = url.pathname.match(/^\/screen\/(\d+)\/?$/)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const relay = fragment.get('r')
  const room = fragment.get('h')
  const token = fragment.get('g')
  if (!screen || !relay || !room || !token) return null
  return {
    relay,
    room,
    token,
    pcRoom: fragment.get('p'),
    screenId: Number(screen[1]),
  }
}

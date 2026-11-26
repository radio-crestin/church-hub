import {
  createTunnel,
  type Tunnel,
} from '~/features/remote-access/tunnel/createTunnel'
import type { BrowserServer } from './startBrowserServer'

const ASK = 'church-hub-display-connect'
const ANSWER = 'church-hub-display-port'

/** What the opener hands a display: its server, and whom it signs in as. */
interface Answer {
  type: typeof ANSWER
  userToken: string
}

/** A display's way to the server running in its opener. */
export interface OpenerServer {
  tunnel: Tunnel
  userToken: string
}
/** The opener answers at once; past this, the window starts on its own. */
const ANSWER_MS = 3000

/**
 * The page running the browser server lets the windows it opened (a
 * presentation's displays: the phone's own screen, a second monitor) reach
 * it: each gets a port of its own to the server in this page's worker, and
 * the session it signs in with (kept in memory only, never stored). Only one
 * page can hold the server's database, so displays can't start their own.
 */
export function shareServer(server: BrowserServer): void {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data !== ASK) return
    const display = event.source as Window | null
    const answer: Answer = { type: ANSWER, userToken: server.userToken }
    display?.postMessage(answer, window.location.origin, [server.openPort()])
  })
}

/** A tunnel over a port another page handed over (shareServer). */
function portTunnel(port: MessagePort): Tunnel {
  const channel = {
    send: (text: string) => port.postMessage(text),
    close: () => port.close(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onclose: null as ((event: Event) => void) | null,
  }
  port.onmessage = (event) => channel.onmessage?.(event)
  return createTunnel(channel)
}

/**
 * A window the app opened (a display) reaches the server running in its
 * opener, when there is one; null otherwise.
 */
export function connectToOpener(): Promise<OpenerServer | null> {
  const opener = window.opener as Window | null
  if (!opener || opener === window) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ANSWER_MS)
    window.addEventListener('message', function answered(event) {
      const answer = event.data as Answer | null
      if (event.origin !== window.location.origin || answer?.type !== ANSWER) {
        return
      }
      clearTimeout(timer)
      window.removeEventListener('message', answered)
      const [port] = event.ports
      resolve(
        port ? { tunnel: portTunnel(port), userToken: answer.userToken } : null,
      )
    })
    try {
      opener.postMessage(ASK, window.location.origin)
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

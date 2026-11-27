import type { BrowserServer } from '~/features/browser-server'
import { relayFetch, tunnelFetch } from '~/features/remote-access'
import { createLogger } from '~/utils/logger'
import { answerScreenOffer, type ScreenPeers } from './answerScreenOffer'
import { hostedRoomId, newHostKey } from './hostedRoomId'

const logger = createLogger('screen-links')

/** As often as the PC looks for offers (remote-access/remoteAccess.ts). */
const POLL_MS = 2000
/** The relay forgets a room after an hour: registered again before. */
const REGISTER_MS = 30 * 60 * 1000
/**
 * How often the room checks it still has links. A revoked link's device
 * reaches the room once more, to hear it was revoked.
 */
const LINKS_CHECK_MS = 5 * 60 * 1000
/** Lets the channels' close reach the devices before the connections go. */
const CLOSE_GRACE_MS = 1000

interface Host {
  server: BrowserServer
  relay: string
  churchId: string
  pcRoom: string | null
  peers: ScreenPeers
  /** Set while the room is open. */
  stop: (() => Promise<void>) | null
}

let host: Host | null = null

/** This phone's host key for its church, kept so a reload keeps its room. */
function hostKey(churchId: string): string {
  const name = `church-hub-screen-host-key:${churchId}`
  const key = localStorage.getItem(name) ?? newHostKey()
  localStorage.setItem(name, key)
  return key
}

/** Whether the church has screen links that still stand. */
async function hasScreenLinks({ server }: Host): Promise<boolean> {
  const response = await tunnelFetch(
    server.tunnel,
    new Request('http://church-pc.invalid/api/screen-links'),
    server.userToken,
  )
  if (!response.ok) return false
  const { data } = (await response.json()) as { data: unknown[] }
  return data.length > 0
}

/** Opens the room on the relay and answers its offers; returns its closer. */
function openRoom(current: Host, key: string, room: string) {
  const authorization = { authorization: `Bearer ${key}` }
  const post = (path: string, body: unknown) =>
    relayFetch(`${current.relay}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authorization },
      body: JSON.stringify(body),
    })

  const register = async () => {
    const response = await post('/signal/register', { secret: room })
    if (!response.ok) logger.warn(`Room refused (${response.status})`)
  }
  const closeWithoutLinks = async () => {
    if (await hasScreenLinks(current)) return
    logger.info('No screen links stand: the room closes')
    await stopHostingScreens()
  }

  let polling = false
  const poll = async () => {
    if (polling) return
    polling = true
    try {
      const response = await relayFetch(
        `${current.relay}/signal/${room}/offers`,
        { headers: authorization },
      )
      if (!response.ok) return
      const { offers } = (await response.json()) as {
        offers?: Array<{ sessionId: string; offer: string }>
      }
      for (const { sessionId, offer } of offers ?? []) {
        const answer = await answerScreenOffer(
          offer,
          current.server,
          current.peers,
        )
        await post(`/signal/${room}/answer`, { sessionId, answer })
      }
    } catch (error) {
      logger.warn('Screen offers not answered', error)
    } finally {
      polling = false
    }
  }

  const timers = [
    setInterval(() => void register(), REGISTER_MS),
    setInterval(() => void closeWithoutLinks(), LINKS_CHECK_MS),
    setInterval(() => void poll(), POLL_MS),
  ]
  return {
    registered: post('/signal/register', { secret: room }),
    stop: async () => {
      for (const timer of timers) clearInterval(timer)
      await post('/signal/unregister', { secret: room }).catch((error) =>
        logger.warn('Room not closed on the relay', error),
      )
    },
  }
}

/**
 * The phone running the church's server (T-175) hosts its screen links
 * (T-214): it keeps a room open on the relay while any link stands, and
 * answers the devices that open one. Called once the server is up.
 */
export async function startScreenHost(
  server: BrowserServer,
  church: { relay: string; churchId: string; pcRoom: string | null },
): Promise<void> {
  host = { server, ...church, peers: new Map(), stop: null }
  if (await hasScreenLinks(host)) await hostScreens()
}

/** Whether this page can host screen links (the phone's own server). */
export const canHostScreens = () => host !== null

/**
 * Opens the room (a link was just made); resolves once the relay has it.
 * Returns where devices reach it, for the link.
 */
export async function hostScreens(): Promise<{
  relay: string
  room: string
  pcRoom: string | null
}> {
  if (!host) throw new Error('This page runs no church server to host')
  const key = hostKey(host.churchId)
  const room = await hostedRoomId(key)
  if (!host.stop) {
    const opened = openRoom(host, key, room)
    host.stop = opened.stop
    const response = await opened.registered
    if (!response.ok)
      throw new Error(`The relay refused the room (${response.status})`)
    logger.info('Screen room open')
  }
  return { relay: host.relay, room, pcRoom: host.pcRoom }
}

/**
 * Cuts every device showing a screen through this phone (a link was
 * revoked): those whose link still stands connect again.
 */
export function disconnectScreens(): void {
  // Closing the channels first tells the device at once; the connection
  // alone ends only when its ICE times out, the slide still showing.
  for (const [pc, channels] of host?.peers ?? []) {
    for (const channel of channels) channel.close()
    setTimeout(() => pc.close(), CLOSE_GRACE_MS)
  }
  host?.peers.clear()
}

/** Closes the room (no link stands any more). */
export async function stopHostingScreens(): Promise<void> {
  if (!host) return
  disconnectScreens()
  await host.stop?.()
  host.stop = null
}

import { WEB_APP_API_ORIGIN } from '~/config'
import {
  type BootStep,
  type BrowserServer,
  connectToOpener,
  OtherTabError,
  type StartMessage,
  shareServer,
  startBrowserServer,
} from '~/features/browser-server'
import { installTunnel, type Tunnel } from '~/features/remote-access'
import {
  parseScreenLinkUrl,
  startScreenDisplay,
  startScreenHost,
} from '~/features/screen-links'
import {
  setLoadingError,
  updateLoadingMessage,
} from '~/features/startup/loadingScreen'
import {
  type StartupStepKey,
  startupStepText,
  startupText,
} from '~/features/startup/startupText'
import { setStoredUserToken } from '~/service/api-url'
import { captureError } from '~/utils/error-handler'
import type { ChurchBinding } from './churchBinding'
import { connectToPc } from './connectToPc'
import { type ChurchSession, openChurchSession } from './openChurchSession'
import { reloadIfRemoved } from './reloadIfRemoved'

/** A start that stops at a notice: a failed link, or a removed device. */
export type WebAppNotice = Exclude<
  ChurchSession,
  { kind: 'joined' } | { kind: 'notJoined' }
>

/** What each first-start step of the browser server shows. */
const STEP_TEXT: Record<BootStep, StartupStepKey> = {
  download: 'download',
  seed: 'database',
  sync: 'sync',
  search: 'search',
  save: 'save',
}

/** The full app, on the server the tunnel reaches (the router mounts it). */
async function runApp(tunnel: Tunnel, userToken?: string): Promise<void> {
  if (userToken) setStoredUserToken(userToken)
  installTunnel(tunnel, WEB_APP_API_ORIGIN)
  // A server gone (the PC turned off): the next start finds the way again.
  tunnel.onClose(() => window.location.reload())
  await import('~/router')
}

function failed(message: string, hint: string, error?: unknown): void {
  if (error) captureError(error, { source: 'startup', component: 'web-app' })
  setLoadingError(
    message,
    hint,
    { label: startupText('retry'), onClick: () => window.location.reload() },
    error instanceof Error ? error.message : undefined,
  )
}

/**
 * Runs the church server in this browser, a church's or a guest's, and
 * lets the windows it opens (displays) reach it. A display opened by the
 * page running it uses that page's.
 */
async function runBrowserServer(
  start: StartMessage,
  onRevoked: () => void = () => {},
  onStarted: (server: BrowserServer) => void = () => {},
): Promise<void> {
  const opener = await connectToOpener()
  if (opener) return runApp(opener.tunnel, opener.userToken)
  try {
    const server = await startBrowserServer(
      start,
      (step) => updateLoadingMessage(startupStepText(STEP_TEXT[step])),
      onRevoked,
    )
    shareServer(server)
    onStarted(server)
    await runApp(server.tunnel, server.userToken)
  } catch (error) {
    if (error instanceof OtherTabError) {
      failed(startupText('otherTab'), startupText('otherTabHint'))
      return
    }
    failed(startupText('errorWebStart'), startupText('retryHint'), error)
  }
}

/**
 * A joined device: the church PC when it answers (over WebRTC, T-174),
 * else the church's server in this browser, synced through the cloud.
 */
async function startChurch(binding: ChurchBinding): Promise<void> {
  updateLoadingMessage(startupText('reachingChurchPc'))
  const tunnel = await connectToPc(binding)
  if (tunnel) return runApp(tunnel)

  const { deviceId, userId } = binding
  if (!deviceId || !userId) {
    failed(startupText('needsOnlineOnce'), startupText('retryHint'))
    return
  }
  return runBrowserServer(
    {
      type: 'start',
      mode: 'church',
      church: {
        serviceUrl: binding.serviceUrl,
        churchId: binding.churchId,
        readUrl: binding.readUrl,
        token: binding.token,
        deviceId,
        userId,
      },
    },
    () => void reloadIfRemoved(binding),
    // Other devices show its screens through it while the PC is off (T-214).
    (server) =>
      void startScreenHost(server, {
        relay: binding.relayUrl,
        churchId: binding.churchId,
        pcRoom: binding.pcSignalId,
      }).catch((error) =>
        captureError(error, { source: 'startup', component: 'screen-links' }),
      ),
  )
}

/**
 * The web app's start (`bun run build:public`): the full app, on the church
 * PC or on the church's server running in this browser; with no church, as
 * a guest on the Church Hub library a new PC starts with. A link that
 * failed, or a device the church removed, says so first.
 */
export async function startWebApp(): Promise<WebAppNotice | null> {
  updateLoadingMessage(startupText('starting'))
  // A screen link another device opened (T-214): that screen, nothing else.
  const screenLink = parseScreenLinkUrl(new URL(window.location.href))
  if (screenLink) {
    await startScreenDisplay(screenLink)
    return null
  }
  const session = await openChurchSession()
  if (session.kind === 'joined') await startChurch(session.binding)
  else if (session.kind === 'notJoined') await startGuest()
  else return session
  return null
}

/** No church: a guest on the library a new PC starts with. */
export function startGuest(): Promise<void> {
  return runBrowserServer({ type: 'start', mode: 'guest' })
}

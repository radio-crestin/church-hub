/**
 * The browser server: the church server's own HTTP API and database, run in
 * this Web Worker on sqlite-wasm (T-175), for a web app no church PC
 * answers. The page starts it (StartMessage), hears it boot (BootMessage),
 * then talks to it as to the PC: over the tunnel's protocol.
 */
import './shims/globals'

import { bootBrowserServer, churchDatabaseFile } from './bootBrowserServer'
import { openStorage } from './database'
import type {
  BootMessage,
  ConnectMessage,
  ForgetMessage,
  StartMessage,
} from './protocol'
import { workerTarget } from './workerTarget'
import { createFetchHandler } from '../../../../../server/src/http/createFetchHandler'
import { createTunnelSession } from '../../../../../server/src/service/remote-access/tunnelSession'
import { onTokenRefused } from '../../../../../server/src/service/sync/cloud/tokenRefused'
import { createLogger } from '../../../../../server/src/utils/logger'

const logger = createLogger('browser-server')

const post = (message: BootMessage | string) => self.postMessage(message)

let session: ReturnType<typeof createTunnelSession> | null = null
let target: ReturnType<typeof workerTarget> | null = null

async function start(message: StartMessage): Promise<void> {
  // A revoked device loses the church on the request that finds it out.
  if (message.mode === 'church') onTokenRefused(() => post({ type: 'revoked' }))
  try {
    const booted = await bootBrowserServer(message, (step) =>
      post({ type: 'progress', step }),
    )
    target = workerTarget(createFetchHandler())
    session = createTunnelSession(post, target)
    post({ type: 'ready', ...booted })
  } catch (error) {
    logger.error(`Boot failed: ${error instanceof Error ? error.stack : error}`)
    post({
      type: 'failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** A display window's own session, on the port the page handed over. */
function connect(port: MessagePort | undefined): void {
  if (!port || !target) return
  const display = createTunnelSession((text) => port.postMessage(text), target)
  port.onmessage = (event: MessageEvent<string>) => display.receive(event.data)
}

async function forget({ churchId }: ForgetMessage): Promise<void> {
  const storage = await openStorage()
  storage.pool?.unlink(churchDatabaseFile(churchId))
  post({ type: 'forgotten' })
}

self.onmessage = (
  event: MessageEvent<StartMessage | ConnectMessage | ForgetMessage | string>,
) => {
  if (typeof event.data === 'string') session?.receive(event.data)
  else if (event.data.type === 'start') void start(event.data)
  else if (event.data.type === 'connect') connect(event.ports[0])
  else if (event.data.type === 'forget') void forget(event.data)
}

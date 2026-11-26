import {
  createTunnel,
  type Tunnel,
} from '~/features/remote-access/tunnel/createTunnel'
import { holdServerLock } from './holdServerLock'
import type { BootMessage, BootStep, StartMessage } from '../worker/protocol'

export interface BrowserServer {
  tunnel: Tunnel
  /** Whom the page signs in as (X-User-Auth). */
  userToken: string
  /** False when the browser keeps nothing (no OPFS): memory only. */
  persistent: boolean
}

/**
 * Starts the church server in a Web Worker of this page (T-175): its
 * database on sqlite-wasm, a church's synced or a guest's own. Resolves
 * once it is ready, with the tunnel the page reaches it through: the same
 * the church PC answers over WebRTC. Another tab running it already:
 * OtherTabError.
 */
export async function startBrowserServer(
  start: StartMessage,
  onStep: (step: BootStep) => void,
): Promise<BrowserServer> {
  await holdServerLock()
  const worker = new Worker(
    new URL('../worker/browserServer.worker.ts', import.meta.url),
    { type: 'module', name: 'church-hub-server' },
  )
  const channel = {
    send: (text: string) => worker.postMessage(text),
    close: () => worker.terminate(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onclose: null as ((event: Event) => void) | null,
  }

  return new Promise((resolve, reject) => {
    worker.onerror = (event) => {
      reject(new Error(event.message || 'The browser server stopped'))
      channel.onclose?.(new Event('close'))
    }
    worker.onmessage = (event: MessageEvent<BootMessage | string>) => {
      const message = event.data
      if (typeof message === 'string') {
        channel.onmessage?.(event)
        return
      }
      if (message.type === 'progress') onStep(message.step)
      if (message.type === 'failed') {
        worker.terminate()
        reject(new Error(message.message))
      }
      if (message.type === 'ready') {
        resolve({
          tunnel: createTunnel(channel),
          userToken: message.userToken,
          persistent: message.persistent,
        })
      }
    }
    worker.postMessage(start)
  })
}

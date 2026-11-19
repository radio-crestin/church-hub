import { spawn } from 'node:child_process'

import { parseHelperLine } from './helperEvents'
import { writeHelperScript } from './helperScript'
import { inworldLogger as logger } from './inworldLogger'
import { getVenvPython, getWeightsPath } from './inworldPaths'

export interface InworldStreamHandlers {
  onReady: (device: string) => void
  /** Isolated 48 kHz mono s16le, in pieces of any size (even odd bytes). */
  onVoice: (pcm: Buffer) => void
  onExit: (code: number | null) => void
}

export interface InworldStream {
  write: (pcm: Buffer) => void
  /** Closes its input: it flushes the rest and exits. */
  end: () => void
  kill: () => void
}

/** Starts the helper streaming 48 kHz mono s16le through the realtime model. */
export function startInworldStream(
  handlers: InworldStreamHandlers,
): InworldStream {
  const child = spawn(
    getVenvPython(),
    [writeHelperScript(), 'stream', '--weights', getWeightsPath()],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  )
  logger.info('Inworld stream starting', { pid: child.pid })
  child.stdout.on('data', handlers.onVoice)
  let pending = ''
  child.stderr.on('data', (data: Buffer) => {
    const lines = (pending + data.toString()).split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) {
      const event = parseHelperLine(line)
      if (event?.event === 'ready') handlers.onReady(event.device ?? '')
      if (event?.event === 'error') {
        logger.error('Inworld stream error', { message: event.message })
      }
    }
  })
  // A write after the helper died must not crash the server.
  child.stdin.on('error', (error) =>
    logger.warn('Inworld stream input closed', { error: String(error) }),
  )
  child.on('error', (error) => {
    logger.error('Inworld stream failed to start', { error: String(error) })
  })
  child.on('close', (code) => {
    logger.info('Inworld stream ended', { code })
    handlers.onExit(code)
  })
  return {
    write: (pcm) => {
      if (child.stdin.writable) child.stdin.write(pcm)
    },
    end: () => child.stdin.end(),
    kill: () => child.kill(),
  }
}

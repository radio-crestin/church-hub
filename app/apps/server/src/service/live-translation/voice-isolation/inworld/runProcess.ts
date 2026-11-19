import { spawn } from 'node:child_process'

import { inworldLogger as logger } from './inworldLogger'

/**
 * Runs a command to its end, an args array and no shell, handing each line
 * of its stderr and stdout to `onLine`. Rejects with its last lines when it
 * fails, so the operator sees why.
 */
export function runProcess(
  command: string,
  args: string[],
  onLine: (line: string) => void = (line) => logger.debug(line),
): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Running', { command, args })
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const tail: string[] = []
    const read = (stream: NodeJS.ReadableStream) => {
      let pending = ''
      stream.on('data', (data: Buffer) => {
        const lines = (pending + data.toString()).split(/\r?\n/)
        pending = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          tail.push(line)
          if (tail.length > 5) tail.shift()
          onLine(line)
        }
      })
    }
    read(child.stdout)
    read(child.stderr)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else
        reject(new Error(`${command} exited with ${code}: ${tail.join(' | ')}`))
    })
  })
}

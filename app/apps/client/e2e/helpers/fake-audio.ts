import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { FAKE_AUDIO_PORT } from '../../playwright.config'

const SCRIPT = fileURLToPath(new URL('./fake-audio-server.ts', import.meta.url))

/**
 * Starts the stand-in audio server where the test server looks for one, so
 * a click on a track really starts it. Returns the function that stops it.
 */
export async function startFakeAudioServer(): Promise<() => void> {
  const child = spawn(
    process.platform === 'win32' ? 'bun.exe' : 'bun',
    [SCRIPT, String(FAKE_AUDIO_PORT)],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await new Promise<void>((resolve, reject) => {
    let output = ''
    const timer = setTimeout(
      () => reject(new Error(`fake audio server did not start: ${output}`)),
      15_000,
    )
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('[fake-audio] listening')) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`fake audio server exited (${code}): ${output}`))
    })
  })
  return () => child.kill()
}

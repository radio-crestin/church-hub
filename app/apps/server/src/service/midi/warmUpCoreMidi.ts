import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { COREMIDI_WARM_UP_FLAG } from './coreMidiWarmUpFlag'
import { midiLogger } from '../../utils/fileLogger'

const execFileAsync = promisify(execFile)

const MAX_ATTEMPTS = 4
const RETRY_DELAY_MS = 500
const HELPER_TIMEOUT_MS = 15_000

/**
 * Makes sure the macOS MIDI server is up before this process asks it for a
 * client.
 *
 * The MIDI server quits about 5.4 s after its last client leaves. A process
 * asking for its first client in that moment is refused (-304) and is
 * refused forever after, so MIDI would stay off until the app restarts.
 * A short-lived helper process takes that risk instead: if it is refused,
 * the next helper starts a fresh MIDI server. Once a helper got a client,
 * the server stays up for seconds, plenty for this process to get its own.
 * Returns whether a helper got a client.
 */
export async function warmUpCoreMidi(
  runHelper: () => Promise<void> = runWarmUpHelper,
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await runHelper()
      midiLogger.debug(`CoreMIDI warm-up succeeded (attempt ${attempt})`)
      return true
    } catch (error) {
      midiLogger.warn(
        `CoreMIDI warm-up attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error instanceof Error ? error.message : error}`,
      )
    }
    if (attempt < MAX_ATTEMPTS) await Bun.sleep(RETRY_DELAY_MS)
  }
  return false
}

/**
 * Runs this server binary as the warm-up helper; rejects unless it exits 0
 * (exit 2: CoreMIDI refused the client, see coreMidiWarmUpEntry).
 */
async function runWarmUpHelper(): Promise<void> {
  try {
    await execFileAsync(process.execPath, warmUpHelperArgs(), {
      timeout: HELPER_TIMEOUT_MS,
      // Minimal env: the helper must never pick up production start-up settings.
      env: { PATH: process.env.PATH ?? '' },
    })
  } catch (error) {
    const { code, signal } = error as { code?: number; signal?: string }
    throw new Error(
      `helper exited with code ${code ?? '-'}, signal ${signal ?? '-'}`,
    )
  }
}

/**
 * The compiled sidecar runs its embedded entry by itself; in development the
 * Bun runtime needs the entry script path in front of the flag.
 */
function warmUpHelperArgs(): string[] {
  const isCompiled = Bun.main.includes('$bunfs') || Bun.main.includes('~BUN')
  return isCompiled
    ? [COREMIDI_WARM_UP_FLAG]
    : [Bun.main, COREMIDI_WARM_UP_FLAG]
}

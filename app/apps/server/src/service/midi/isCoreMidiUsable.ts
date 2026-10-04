import { createCoreMidiClient } from './createCoreMidiClient'
import { midiLogger } from '../../utils/fileLogger'

/**
 * Tells whether the MIDI native module can be loaded without crashing.
 *
 * Only macOS needs the check: there the native module aborts the process
 * when CoreMIDI refuses a client (see createCoreMidiClient). A process that
 * got a refusal never gets a client later, so there is no retry: MIDI stays
 * off until the app restarts, and the server keeps running.
 */
export function isCoreMidiUsable(
  platform: NodeJS.Platform = process.platform,
  createClient: () => number = createCoreMidiClient,
): boolean {
  if (platform !== 'darwin') return true

  let status: number
  try {
    status = createClient()
  } catch (error) {
    midiLogger.error(
      `CoreMIDI could not be loaded, MIDI disabled: ${error instanceof Error ? error.message : error}`,
    )
    return false
  }

  if (status !== 0) {
    midiLogger.warn(
      `CoreMIDI refused a MIDI client (status ${status}), MIDI disabled until Church Hub restarts`,
    )
    return false
  }

  midiLogger.debug('CoreMIDI client created')
  return true
}

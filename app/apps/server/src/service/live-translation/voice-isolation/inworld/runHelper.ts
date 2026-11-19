import { type HelperEvent, parseHelperLine } from './helperEvents'
import { writeHelperScript } from './helperScript'
import { getVenvPython } from './inworldPaths'
import { runProcess } from './runProcess'

/** Runs one of the helper's batch commands (download, bench) to its end. */
export async function runHelper(
  args: string[],
  onEvent: (event: HelperEvent) => void,
): Promise<void> {
  let failure: string | undefined
  try {
    await runProcess(
      getVenvPython(),
      [writeHelperScript(), ...args],
      (line) => {
        const event = parseHelperLine(line)
        if (event?.event === 'error') failure = event.message
        else if (event) onEvent(event)
      },
    )
  } catch (error) {
    throw failure ? new Error(failure) : error
  }
}

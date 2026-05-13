import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

import { getLogsDir } from '../../utils/paths'

/**
 * Opens the logs directory in the user's native file manager.
 * Cross-platform: `open` (macOS), `explorer` (Windows), `xdg-open` (Linux).
 *
 * Creates the directory first if it doesn't exist yet — otherwise file
 * managers error out with "no such directory" on a fresh install.
 */
export function openLogsFolder(): { path: string } {
  const dir = getLogsDir()

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const platform = process.platform
  let cmd: string
  let args: string[]
  if (platform === 'darwin') {
    cmd = 'open'
    args = [dir]
  } else if (platform === 'win32') {
    // explorer.exe returns a non-zero exit code on success — ignore via detach
    cmd = 'explorer.exe'
    args = [dir]
  } else {
    cmd = 'xdg-open'
    args = [dir]
  }

  // Detached + unref so the file manager keeps running after the request
  // completes and we don't accumulate zombie processes.
  const child = execFile(cmd, args, { windowsHide: true })
  child.unref()

  return { path: dir }
}

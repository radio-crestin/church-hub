import { spawn } from 'node:child_process'
import { chmod, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { markInstalling } from './downloadUpdate'
import type { OperationResult } from './types'
import { createLogger } from '../../utils/logger'
import { getDataDir } from '../../utils/paths'

const logger = createLogger('app-update')

/**
 * The installed application this process belongs to.
 *
 * The sidecar is bundled with the app, so its own location gives away where the
 * app lives — the same per-platform layout the compile script targets:
 *   macOS   `<App>.app/Contents/MacOS/<sidecar>`
 *   Windows `<install dir>/<sidecar>.exe`, beside the main executable
 */
function resolveInstalledApp(): { appPath: string; launchPath: string } | null {
  const execPath = process.execPath

  if (process.platform === 'darwin') {
    // .../Church Hub.app/Contents/MacOS/church-hub-sidecar
    const macOsDir = dirname(execPath)
    const contentsDir = dirname(macOsDir)
    const appPath = dirname(contentsDir)
    if (!appPath.endsWith('.app')) return null
    return { appPath, launchPath: appPath }
  }

  if (process.platform === 'win32') {
    const installDir = dirname(execPath)
    return {
      appPath: installDir,
      launchPath: join(installDir, 'church-hub.exe'),
    }
  }

  return null
}

/**
 * Shell-quotes a path for the helper script. Paths here come from the app's own
 * location and the operator's chosen folder, but both routinely contain spaces
 * ("Church Hub.app", "Application Support"), so quoting is not optional.
 */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * macOS: mount the .dmg, replace the installed bundle, relaunch.
 *
 * Runs as a detached script because it replaces the very application that asks
 * for it — the app has to be gone before its bundle can be swapped. The script
 * waits for the app's process to exit first, so nothing is touched while it is
 * still running.
 */
function buildMacScript(
  dmgPath: string,
  appPath: string,
  appPid: number,
): string {
  return `#!/bin/bash
set -e

# Wait for the running app to quit before touching its bundle (max ~30s).
for _ in $(seq 1 300); do
  kill -0 ${appPid} 2>/dev/null || break
  sleep 0.1
done

MOUNT_POINT=$(mktemp -d /tmp/church-hub-update.XXXXXX)
hdiutil attach ${shQuote(dmgPath)} -nobrowse -quiet -mountpoint "$MOUNT_POINT"

# The bundle inside the image; its name is whatever the release built.
NEW_APP=$(find "$MOUNT_POINT" -maxdepth 1 -name '*.app' -print -quit)

if [ -n "$NEW_APP" ]; then
  # ditto preserves the bundle's structure, symlinks and code signature.
  rm -rf ${shQuote(appPath)}
  ditto "$NEW_APP" ${shQuote(appPath)}
  # Clear the download quarantine so the swapped bundle opens without a prompt.
  xattr -dr com.apple.quarantine ${shQuote(appPath)} 2>/dev/null || true
fi

hdiutil detach "$MOUNT_POINT" -quiet || true
rmdir "$MOUNT_POINT" 2>/dev/null || true

open -a ${shQuote(appPath)}
`
}

/**
 * Windows: run the NSIS installer silently, then relaunch.
 *
 * `/S` is NSIS's silent switch — no wizard, no prompts. The installer upgrades
 * in place; user data lives in %APPDATA%\\church-hub and is never touched.
 */
function buildWindowsScript(
  installerPath: string,
  launchPath: string,
  appPid: number,
): string {
  return `@echo off
rem Wait for the running app to exit so its files are no longer locked.
for /l %%i in (1,1,300) do (
  tasklist /FI "PID eq ${appPid}" 2>nul | find "${appPid}" >nul || goto :install
  timeout /t 1 /nobreak >nul
)

:install
start /wait "" "${installerPath}" /S
start "" "${launchPath}"
`
}

/**
 * Installs a downloaded artifact without any further interaction.
 *
 * User data survives by construction rather than by special handling: the
 * database and logs live in the per-user data directory (Application Support /
 * %APPDATA%), which neither the bundle swap nor the NSIS upgrade touches, and
 * migrations run on the next boot as they always do.
 *
 * Returns as soon as the helper is running. The caller is expected to quit the
 * app straight after; the helper waits for that before it changes anything.
 *
 * It waits on *this* process rather than the window's: the sidecar is a child
 * of the Tauri app and dies with it, so its exit is the same signal, and unlike
 * the window's process id it is known here without the client having to supply
 * anything (`@tauri-apps/plugin-process` exposes only `exit`/`relaunch`).
 */
export async function installUpdate(filePath: string): Promise<OperationResult> {
  const appPid = process.pid
  const installed = resolveInstalledApp()
  if (!installed) {
    return {
      success: false,
      error: `unsupported_platform:${process.platform}`,
    }
  }

  const artifact = resolve(filePath)
  const scriptDir = getDataDir()
  const isWindows = process.platform === 'win32'
  const scriptPath = join(
    scriptDir,
    isWindows ? 'church-hub-update.cmd' : 'church-hub-update.sh',
  )

  try {
    const script = isWindows
      ? buildWindowsScript(artifact, installed.launchPath, appPid)
      : buildMacScript(artifact, installed.appPath, appPid)

    await writeFile(scriptPath, script, 'utf8')
    if (!isWindows) await chmod(scriptPath, 0o755)

    // Detached and fully disowned: this process is about to be replaced.
    const child = isWindows
      ? spawn('cmd.exe', ['/c', scriptPath], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })
      : spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' })
    child.unref()

    markInstalling()
    logger.info(`Update installer started for ${artifact}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to start the update installer: ${message}`)
    return { success: false, error: message }
  }
}

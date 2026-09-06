import { spawn } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { chmod, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { buildMacUpdater } from './buildMacUpdater'
import { buildWindowsUpdater } from './buildWindowsUpdater'
import { markInstalling } from './downloadUpdate'
import type { OperationResult, UpdateInstallerLabels } from './types'
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

const DEFAULT_LABELS: UpdateInstallerLabels = {
  title: 'Church Hub',
  closing: 'Closing the app…',
  installing: 'Installing the update…',
  launching: 'Starting the new version…',
  hint: 'The app reopens by itself when this is done.',
  failed: 'The update could not be installed: {{reason}}',
  openManually:
    'Open Church Hub yourself; the downloaded installer is in the downloads folder.',
}

/**
 * Installs a downloaded artifact without any further interaction, behind a
 * native progress window.
 *
 * User data survives by construction rather than by special handling: the
 * database and logs live in the per-user data directory (Application Support /
 * %APPDATA%), which neither the bundle swap nor the NSIS upgrade touches, and
 * migrations run on the next boot as they always do.
 *
 * Returns as soon as the helper is running. The caller is expected to quit the
 * app straight after; the helper waits for that before it changes anything —
 * and if the app has not gone within a grace period it is terminated, so the
 * update never sits behind an app that did not close. The helper then
 * relaunches the installed app, and writes what it did to
 * `church-hub-update.log` in the data directory.
 *
 * It waits on the Tauri app's process — the sidecar's parent — because that
 * is what holds the bundle / the locked files. The sidecar itself is killed
 * by the app on exit; should it outlive the app, the helper cleans it up too.
 */
export async function installUpdate(
  filePath: string,
  version: string,
  labels: Partial<UpdateInstallerLabels> = {},
): Promise<OperationResult> {
  const installed = resolveInstalledApp()
  if (!installed) {
    return {
      success: false,
      error: `unsupported_platform:${process.platform}`,
    }
  }

  const artifact = resolve(filePath)
  const dataDir = getDataDir()
  const logPath = join(dataDir, 'church-hub-update.log')
  const isWindows = process.platform === 'win32'
  const scriptPath = join(
    dataDir,
    isWindows ? 'church-hub-update.ps1' : 'church-hub-update.js',
  )
  const params = {
    appPid: process.ppid,
    sidecarPid: process.pid,
    version,
    logPath,
    labels: { ...DEFAULT_LABELS, ...labels },
  }

  try {
    if (isWindows) {
      const script = buildWindowsUpdater({
        ...params,
        installerPath: artifact,
        installDir: installed.appPath,
        launchPath: installed.launchPath,
      })
      // Windows PowerShell reads a .ps1 without a BOM as ANSI, which would
      // mangle the diacritics in the labels.
      await writeFile(scriptPath, `\ufeff${script}`, 'utf8')
    } else {
      const script = buildMacUpdater({
        ...params,
        dmgPath: artifact,
        appPath: installed.appPath,
      })
      await writeFile(scriptPath, script, 'utf8')
      await chmod(scriptPath, 0o644)
    }

    // Detached and fully disowned: this process is about to be replaced.
    // Whatever the interpreter itself prints — a script-execution policy
    // refusing the .ps1, osascript rejecting the script — lands in the same
    // log as the helper's own lines, so a helper that never got going still
    // leaves a trace instead of the app simply not coming back.
    const helperOutput = openSync(logPath, 'a')
    const child = isWindows
      ? spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-STA',
            '-WindowStyle',
            'Hidden',
            '-File',
            scriptPath,
          ],
          {
            detached: true,
            stdio: ['ignore', helperOutput, helperOutput],
            windowsHide: true,
          },
        )
      : spawn('/usr/bin/osascript', ['-l', 'JavaScript', scriptPath], {
          detached: true,
          stdio: ['ignore', helperOutput, helperOutput],
        })
    child.unref()
    closeSync(helperOutput)

    markInstalling()
    logger.info(
      `Update installer started for ${artifact} (app pid ${process.ppid}); log at ${logPath}`,
    )
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to start the update installer: ${message}`)
    return { success: false, error: message }
  }
}

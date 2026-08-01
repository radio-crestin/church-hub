import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

import type { UpdateConfig } from './types'
import { getSetting, upsertSetting } from '../settings/settings'

/**
 * `app_settings` key holding the download folder. Read needs `settings.view`
 * and write needs `settings.edit` through the generic settings routes, which is
 * exactly the admin gate this setting wants — no dedicated table required.
 */
export const UPDATE_DOWNLOAD_DIR_KEY = 'app_update_download_dir'

/**
 * The operating system's Downloads folder — the default when the operator has
 * not chosen one. Resolved by convention rather than by shelling out, so it
 * costs nothing and behaves the same on every platform.
 */
export function getDefaultDownloadDir(): string {
  const home = homedir()
  if (process.platform === 'win32') {
    return join(process.env.USERPROFILE || home, 'Downloads')
  }
  return join(home, 'Downloads')
}

/**
 * The folder new versions are written to.
 *
 * A relative path is refused: downloads are triggered from the UI but written
 * by the sidecar, whose working directory is not something the operator ever
 * sees, so resolving one would scatter installers somewhere unexpected.
 */
export function resolveDownloadDir(): string {
  const configured = getSetting('app_settings', UPDATE_DOWNLOAD_DIR_KEY)
  const value = configured?.value?.trim()
  if (value && isAbsolute(value)) return value
  return getDefaultDownloadDir()
}

export function getUpdateConfig(): UpdateConfig {
  const configured = getSetting('app_settings', UPDATE_DOWNLOAD_DIR_KEY)
  const value = configured?.value?.trim() || null
  return {
    downloadDir: value,
    effectiveDownloadDir: resolveDownloadDir(),
  }
}

/** Sets the download folder; null or an empty string restores the default. */
export function setDownloadDir(dir: string | null): UpdateConfig {
  upsertSetting('app_settings', {
    key: UPDATE_DOWNLOAD_DIR_KEY,
    value: dir?.trim() || '',
  })
  return getUpdateConfig()
}

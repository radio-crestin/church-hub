import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Gets the application data directory
 * In production (Tauri mode), uses ~/Library/Application Support/church-hub
 * In development, uses ./data relative to cwd
 */
export function getDataDir(): string {
  if (process.env.TAURI_MODE === 'true') {
    // Production Tauri app - use Application Support
    const home = homedir()
    return join(home, 'Library', 'Application Support', 'church-hub')
  }
  // Development - use relative path
  return join(process.cwd(), 'data')
}

/**
 * Gets the logs directory
 * In production (Tauri mode), uses ~/Library/Application Support/church-hub/logs
 * In development, uses ./logs relative to cwd
 */
export function getLogsDir(): string {
  if (process.env.TAURI_MODE === 'true') {
    return join(getDataDir(), 'logs')
  }
  return join(process.cwd(), 'logs')
}

/**
 * Gets the database file path
 */
export function getDatabasePath(): string {
  return process.env.DATABASE_PATH || join(getDataDir(), 'app.db')
}

/**
 * Gets the resources directory
 * In production (Tauri mode), returns the path to bundled resources
 * In development, returns null (use node_modules instead)
 */
export function getResourcesDir(): string | null {
  if (process.env.TAURI_MODE === 'true') {
    const execPath = process.execPath
    const platform = process.platform

    if (platform === 'darwin') {
      // macOS: The sidecar binary is at Contents/MacOS/church-hub-sidecar
      // Resources are at Contents/Resources/
      const contentsDir = join(execPath, '..', '..')
      return join(contentsDir, 'Resources')
    }
    if (platform === 'win32') {
      // Windows: Resources are in the same directory as the executable
      return join(execPath, '..')
    }
    // Linux: Resources are in the same directory as the executable
    return join(execPath, '..')
  }
  return null
}

/**
 * Gets the path to the MIDI native module
 * In production, looks in the bundled resources
 * In development, returns null (use standard node_modules resolution)
 */
export function getMidiNativeModulePath(): string | null {
  const resourcesDir = getResourcesDir()
  if (resourcesDir) {
    return join(resourcesDir, 'midi-native', 'midi.node')
  }
  return null
}

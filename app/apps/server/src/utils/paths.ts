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

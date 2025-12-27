import { isMobile } from '~/config'
import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { createLogger } from '~/utils/logger'

/**
 * Screen Wake Lock service for kiosk mode
 * Uses native Tauri plugin on mobile (iOS/Android) for reliable wake lock
 * Falls back to Web Wake Lock API on browsers
 */

const logger = createLogger('kiosk:wake-lock')

let wakeLock: WakeLockSentinel | null = null
let isNativeWakeLockActive = false

/**
 * Checks if we should use the native Tauri plugin for wake lock
 * This is preferred on mobile devices (iOS/Android) where the Web API is unreliable
 */
function shouldUseNativePlugin(): boolean {
  return isTauri() && isMobile()
}

/**
 * Checks if Screen Wake Lock API is supported in the current browser
 */
export function isWakeLockSupported(): boolean {
  // Native plugin is always "supported" on mobile Tauri
  if (shouldUseNativePlugin()) {
    return true
  }
  // Check for Web Wake Lock API support
  return 'wakeLock' in navigator
}

/**
 * Acquires a screen wake lock using native Tauri plugin
 */
async function acquireNativeWakeLock(): Promise<boolean> {
  try {
    const { keepScreenOn } = await import('tauri-plugin-keep-screen-on-api')
    await keepScreenOn(true)
    isNativeWakeLockActive = true
    logger.debug('Native wake lock acquired via Tauri plugin')
    return true
  } catch (error) {
    logger.debug('Failed to acquire native wake lock:', error)
    return false
  }
}

/**
 * Releases the native Tauri wake lock
 */
async function releaseNativeWakeLock(): Promise<void> {
  if (!isNativeWakeLockActive) return

  try {
    const { keepScreenOn } = await import('tauri-plugin-keep-screen-on-api')
    await keepScreenOn(false)
    isNativeWakeLockActive = false
    logger.debug('Native wake lock released via Tauri plugin')
  } catch (error) {
    logger.debug('Error releasing native wake lock:', error)
    isNativeWakeLockActive = false
  }
}

/**
 * Acquires a screen wake lock using Web Wake Lock API
 */
async function acquireWebWakeLock(): Promise<boolean> {
  if (!('wakeLock' in navigator)) {
    logger.debug('Screen Wake Lock API not supported')
    return false
  }

  try {
    // Release existing lock first
    if (wakeLock !== null) {
      await releaseWebWakeLock()
    }

    wakeLock = await navigator.wakeLock.request('screen')

    wakeLock.addEventListener('release', () => {
      logger.debug('Web wake lock released')
      wakeLock = null
    })

    logger.debug('Web wake lock acquired')
    return true
  } catch (error) {
    // Wake lock request can fail if:
    // - Document is not visible
    // - Low battery mode is enabled
    // - User denied permission
    logger.debug('Failed to acquire web wake lock:', error)
    return false
  }
}

/**
 * Releases the Web Wake Lock API lock
 */
async function releaseWebWakeLock(): Promise<void> {
  if (wakeLock !== null) {
    try {
      await wakeLock.release()
      wakeLock = null
      logger.debug('Web wake lock released explicitly')
    } catch (error) {
      logger.debug('Error releasing web wake lock:', error)
      wakeLock = null
    }
  }
}

/**
 * Acquires a screen wake lock to prevent the screen from turning off
 * Uses native Tauri plugin on mobile, Web API otherwise
 * Returns true if successful, false otherwise
 */
export async function acquireWakeLock(): Promise<boolean> {
  if (shouldUseNativePlugin()) {
    return acquireNativeWakeLock()
  }
  return acquireWebWakeLock()
}

/**
 * Releases the current screen wake lock
 */
export async function releaseWakeLock(): Promise<void> {
  if (shouldUseNativePlugin()) {
    await releaseNativeWakeLock()
  } else {
    await releaseWebWakeLock()
  }
}

/**
 * Checks if a wake lock is currently held
 */
export function isWakeLockActive(): boolean {
  if (shouldUseNativePlugin()) {
    return isNativeWakeLockActive
  }
  return wakeLock !== null && !wakeLock.released
}

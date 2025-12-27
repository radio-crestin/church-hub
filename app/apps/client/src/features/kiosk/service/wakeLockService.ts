import { createLogger } from '~/utils/logger'

/**
 * Screen Wake Lock service for kiosk mode
 * Prevents the screen from turning off when kiosk mode is active
 */

const logger = createLogger('kiosk:wake-lock')

let wakeLock: WakeLockSentinel | null = null

/**
 * Checks if Screen Wake Lock API is supported in the current browser
 */
export function isWakeLockSupported(): boolean {
  return 'wakeLock' in navigator
}

/**
 * Acquires a screen wake lock to prevent the screen from turning off
 * Returns true if successful, false otherwise
 */
export async function acquireWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) {
    logger.debug('Screen Wake Lock API not supported')
    return false
  }

  try {
    // Release existing lock first
    if (wakeLock !== null) {
      await releaseWakeLock()
    }

    wakeLock = await navigator.wakeLock.request('screen')

    wakeLock.addEventListener('release', () => {
      logger.debug('Wake lock released')
      wakeLock = null
    })

    logger.debug('Wake lock acquired')
    return true
  } catch (error) {
    // Wake lock request can fail if:
    // - Document is not visible
    // - Low battery mode is enabled
    // - User denied permission
    logger.debug('Failed to acquire wake lock:', error)
    return false
  }
}

/**
 * Releases the current screen wake lock
 */
export async function releaseWakeLock(): Promise<void> {
  if (wakeLock !== null) {
    try {
      await wakeLock.release()
      wakeLock = null
      logger.debug('Wake lock released explicitly')
    } catch (error) {
      logger.debug('Error releasing wake lock:', error)
      wakeLock = null
    }
  }
}

/**
 * Checks if a wake lock is currently held
 */
export function isWakeLockActive(): boolean {
  return wakeLock !== null && !wakeLock.released
}

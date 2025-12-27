import { invoke } from '@tauri-apps/api/core'

import { isMobile } from '~/config'
import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { createLogger } from '~/utils/logger'

const logger = createLogger('kiosk:brightness')

let savedBrightness: number | null = null

/**
 * Checks if brightness control is available (iOS only via Tauri)
 */
export function isBrightnessControlSupported(): boolean {
  return isTauri() && isMobile()
}

/**
 * Sets the screen brightness (0.0 to 1.0)
 * Only works on iOS via Tauri plugin
 */
export async function setBrightness(value: number): Promise<boolean> {
  if (!isBrightnessControlSupported()) {
    logger.debug('Brightness control not supported on this platform')
    return false
  }

  try {
    const clampedValue = Math.max(0, Math.min(1, value))
    await invoke('plugin:screen-brightness|set_brightness', {
      value: clampedValue,
    })
    logger.debug(`Brightness set to ${clampedValue}`)
    return true
  } catch (error) {
    logger.debug('Failed to set brightness:', error)
    return false
  }
}

/**
 * Gets the current screen brightness (0.0 to 1.0)
 * Only works on iOS via Tauri plugin
 */
export async function getBrightness(): Promise<number> {
  if (!isBrightnessControlSupported()) {
    return 1.0
  }

  try {
    const result = await invoke<{ brightness: number }>(
      'plugin:screen-brightness|get_brightness',
    )
    return result.brightness
  } catch (error) {
    logger.debug('Failed to get brightness:', error)
    return 1.0
  }
}

/**
 * Saves the current brightness and dims the screen to 0
 */
export async function dimScreen(): Promise<boolean> {
  if (!isBrightnessControlSupported()) {
    return false
  }

  try {
    // Save current brightness before dimming
    savedBrightness = await getBrightness()
    logger.debug(`Saved brightness: ${savedBrightness}`)

    // Set to minimum brightness
    await setBrightness(0)
    return true
  } catch (error) {
    logger.debug('Failed to dim screen:', error)
    return false
  }
}

/**
 * Restores the screen brightness to the saved value (or 100%)
 */
export async function restoreBrightness(): Promise<boolean> {
  if (!isBrightnessControlSupported()) {
    return false
  }

  try {
    // Restore to saved brightness or full brightness
    const targetBrightness = savedBrightness ?? 1.0
    await setBrightness(targetBrightness)
    logger.debug(`Restored brightness to ${targetBrightness}`)

    // Clear saved brightness
    savedBrightness = null
    return true
  } catch (error) {
    logger.debug('Failed to restore brightness:', error)
    return false
  }
}

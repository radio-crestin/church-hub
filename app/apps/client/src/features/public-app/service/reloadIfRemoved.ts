import { createLogger } from '~/utils/logger'
import type { ChurchBinding } from './churchBinding'
import { fetchDevice } from './fetchDevice'
import { DeviceRefusedError } from './fetchReadUrl'

const logger = createLogger('public-app')

/**
 * The sync service refused this device while the app ran: when the church
 * removed it, the app starts again, says so and forgets the church
 * (openChurchSession); otherwise it runs on.
 */
export async function reloadIfRemoved(binding: ChurchBinding): Promise<void> {
  try {
    await fetchDevice(binding)
    logger.warn('The sync service refused this device, but it is still joined')
  } catch (error) {
    if (error instanceof DeviceRefusedError) window.location.reload()
    else logger.warn('Could not check whether this device was removed', error)
  }
}

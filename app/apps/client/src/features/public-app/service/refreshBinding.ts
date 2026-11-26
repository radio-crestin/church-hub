import {
  type ChurchBinding,
  clearChurchBinding,
  saveChurchBinding,
} from './churchBinding'
import { fetchDevice } from './fetchDevice'
import { DeviceRefusedError, fetchReadUrl } from './fetchReadUrl'

/**
 * On every start: the church's current read path, kept when it moved, and
 * whose device this is. A revoked device forgets the church (null).
 * Offline, the saved one stays.
 */
export async function refreshBinding(
  binding: ChurchBinding,
): Promise<ChurchBinding | null> {
  try {
    const [readUrl, device] = await Promise.all([
      fetchReadUrl(binding),
      fetchDevice(binding),
    ])
    const fresh = { ...binding, readUrl, ...device }
    if (JSON.stringify(fresh) !== JSON.stringify(binding)) {
      saveChurchBinding(fresh)
    }
    return fresh
  } catch (error) {
    if (!(error instanceof DeviceRefusedError)) return binding
    clearChurchBinding()
    return null
  }
}

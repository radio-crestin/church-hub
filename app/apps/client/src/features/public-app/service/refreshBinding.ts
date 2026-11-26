import {
  type ChurchBinding,
  clearChurchBinding,
  saveChurchBinding,
} from './churchBinding'
import { DeviceRefusedError, fetchReadUrl } from './fetchReadUrl'

/**
 * On every start: the church's current read path, kept when it moved. A
 * revoked device forgets the church (null). Offline, the saved one stays.
 */
export async function refreshBinding(
  binding: ChurchBinding,
): Promise<ChurchBinding | null> {
  try {
    const readUrl = await fetchReadUrl(binding)
    if (readUrl === binding.readUrl) return binding
    const moved = { ...binding, readUrl }
    saveChurchBinding(moved)
    return moved
  } catch (error) {
    if (!(error instanceof DeviceRefusedError)) return binding
    clearChurchBinding()
    return null
  }
}

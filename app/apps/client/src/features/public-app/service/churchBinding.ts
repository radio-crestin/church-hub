import { clearStoredUserToken } from '~/service/api-url'

/**
 * What binds this browser or phone to one church server (T-168): saved when
 * it joins with the link, kept in local storage only.
 */
export interface ChurchBinding {
  /** The cloud sync service the device writes through. */
  serviceUrl: string
  churchId: string
  /** The device token, bound to one of the church's accounts. */
  token: string
  /** The church's secret read path in the bucket (it moves on a revoke). */
  readUrl: string
  /** The church computer's remote access room, when it had that on. */
  pcSignalId: string | null
  /** The signaling relay of that room, where WebRTC is set up (T-174). */
  relayUrl: string
  /** This device on the sync service, and its user (T-175; absent before). */
  deviceId?: string
  userId?: string
}

const STORAGE_KEY = 'church-hub-church-binding'

export function getChurchBinding(): ChurchBinding | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  const binding = JSON.parse(stored) as ChurchBinding
  // Joined before T-174: the relay was always the sync service.
  return { ...binding, relayUrl: binding.relayUrl ?? binding.serviceUrl }
}

export function saveChurchBinding(binding: ChurchBinding) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(binding))
}

/** Forgets the church, and the PC session its device token gave (T-174). */
export function clearChurchBinding() {
  localStorage.removeItem(STORAGE_KEY)
  clearStoredUserToken()
}

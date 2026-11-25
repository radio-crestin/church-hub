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
}

const STORAGE_KEY = 'church-hub-church-binding'

export function getChurchBinding(): ChurchBinding | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? (JSON.parse(stored) as ChurchBinding) : null
}

export function saveChurchBinding(binding: ChurchBinding) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(binding))
}

export function clearChurchBinding() {
  localStorage.removeItem(STORAGE_KEY)
}

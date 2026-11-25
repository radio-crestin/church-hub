import type { ChurchState } from './state/ChurchState'

export interface DeviceSummary {
  id: string
  name: string
  userId: string | null
  isServer: boolean
  createdAt: number
  revokedAt: number | null
}

/** The church's devices, newest first, without their token hashes. */
export function listDevices(state: ChurchState): DeviceSummary[] {
  return state.devices
    .map(({ id, name, userId, isServer, createdAt, revokedAt }) => ({
      id,
      name,
      userId,
      isServer,
      createdAt,
      revokedAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

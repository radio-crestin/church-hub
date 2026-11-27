import { relayFetch } from '~/features/remote-access'

/** Whether the church PC's room is open on the relay (the PC is on). */
export async function pcRoomActive(relay: string, pcRoom: string) {
  try {
    const response = await relayFetch(`${relay}/signal/${pcRoom}/check`)
    const { active } = (await response.json()) as { active?: boolean }
    return active === true
  } catch {
    return false
  }
}

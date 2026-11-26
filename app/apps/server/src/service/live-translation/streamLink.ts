import { deleteSetting, getSetting, upsertSetting } from '../settings'
import { hostedRoomId, newHostKey } from '../signaling/hostedRoom'

const HOST_KEY_SETTING = 'live_translation_stream_host_key'
/**
 * The listener link's room id that released versions made (32 characters,
 * hosted without a key). Links and QR codes churches already shared carry
 * it, so the room stays open next to the new one until it is turned off.
 */
const OLD_SECRET_SETTING = 'live_translation_stream_secret'

export interface StreamRoom {
  secret: string
  /** Null for the old link's room, which the relay hosts by its id alone. */
  hostKey: string | null
}

function streamHostKey(): string {
  const saved = getSetting('app_settings', HOST_KEY_SETTING)?.value
  if (saved) return saved
  const hostKey = newHostKey()
  upsertSetting('app_settings', { key: HOST_KEY_SETTING, value: hostKey })
  return hostKey
}

/** The room id in the listener link (/listen/<id>). */
export const getStreamSecret = () => hostedRoomId(streamHostKey())

/** The old link's room id, while it is still served. */
export const getOldStreamSecret = () =>
  getSetting('app_settings', OLD_SECRET_SETTING)?.value ?? null

/** Every room listeners can join this computer by. */
export function getStreamRooms(): StreamRoom[] {
  const hostKey = streamHostKey()
  const rooms: StreamRoom[] = [{ secret: hostedRoomId(hostKey), hostKey }]
  const old = getOldStreamSecret()
  if (old) rooms.push({ secret: old, hostKey: null })
  return rooms
}

/** Stops serving the old link: only the current one is left. */
export function retireOldStreamLink(): void {
  deleteSetting('app_settings', OLD_SECRET_SETTING)
}

/** A new listener link; the old one, if any, goes too. */
export function renewStreamLink(): string {
  retireOldStreamLink()
  const hostKey = newHostKey()
  upsertSetting('app_settings', { key: HOST_KEY_SETTING, value: hostKey })
  return hostedRoomId(hostKey)
}

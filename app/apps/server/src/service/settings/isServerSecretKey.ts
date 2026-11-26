/**
 * Setting keys that hold, or once held, secrets only the server may know:
 * the signaling room secrets of earlier versions and the host keys that
 * replaced them (now in server_secrets). The settings API never reads,
 * lists, writes or deletes them, so a stray copy can't leave the server.
 */
const SERVER_SECRET_KEYS = new Set([
  'live_translation_stream_secret',
  'live_translation_host_key',
  'live_translation_stream_host_key',
  'remote_access_secret',
  'remote_access_host_key',
  'signaling_host_secret',
])

export const isServerSecretKey = (key: string) => SERVER_SECRET_KEYS.has(key)

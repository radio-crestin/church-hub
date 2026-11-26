/**
 * `service/sync/cloud/getInstallation.ts` in the browser build: a browser is
 * a device with its own token, not a PC holding the church's server token,
 * so it names no installation (the service checks those for the server
 * token only, T-172).
 */
export interface Installation {
  id: string
  name: string
}

export function getInstallation(): Installation | null {
  return null
}

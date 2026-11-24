import { fetcher } from '~/utils/fetcher'

/** The computer's remote access (Settings > Phones; server /api/remote-access). */
export interface RemoteAccess {
  enabled: boolean
  /** The room phones look for this computer in on the relay. */
  secret: string
  relay: string
}

export async function getRemoteAccess(): Promise<RemoteAccess> {
  const { data } = await fetcher<{ data: RemoteAccess }>('/api/remote-access')
  return data
}

export async function setRemoteAccessEnabled(
  enabled: boolean,
): Promise<RemoteAccess> {
  const { data } = await fetcher<{ data: RemoteAccess }>('/api/remote-access', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  return data
}

/** The pairing QR code's fragment that lets a phone connect from away. */
export function remotePairingFragment({ secret, relay }: RemoteAccess): string {
  return `#${new URLSearchParams({ remote: secret, relay })}`
}

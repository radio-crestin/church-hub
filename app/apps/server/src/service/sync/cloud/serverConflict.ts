/** Another PC holding this church server's token (a restored backup). */
export interface ServerConflict {
  /** The other PC's name, when it gave one. */
  otherPcName: string | null
  /** Unix seconds the other PC last called the service. */
  otherPcLastSeenAt: number | null
}

let conflict: ServerConflict | null = null

/**
 * Set when the service answers 409 server_in_use: the church's token is
 * held by another installation. Sync stops until the user picks which PC
 * keeps the church (keepCloudChurch). In memory: after a restart the next
 * call to the service finds it again.
 */
export function getServerConflict(): ServerConflict | null {
  return conflict
}

export function setServerConflict(next: ServerConflict | null): void {
  conflict = next
}

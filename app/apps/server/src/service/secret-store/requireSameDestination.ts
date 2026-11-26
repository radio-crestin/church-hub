/**
 * A save that would keep a saved secret (sent back masked, or left out)
 * while changing where it is sent. Refused, or anyone allowed to edit the
 * setting could point it at their own server and receive the key.
 */
export class SecretDestinationChangedError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(
      `Re-enter the key for the new address: ${fields.join(', ')} changed, and a saved key is never sent to a new address.`,
    )
    this.name = 'SecretDestinationChangedError'
  }
}

/**
 * Throws SecretDestinationChangedError unless every destination field of
 * `next` equals the stored one. Missing and empty count as the same.
 */
export function requireSameDestination(
  stored: Record<string, unknown>,
  next: Record<string, unknown>,
  destination: readonly string[],
): void {
  const changed = destination.filter(
    (field) => String(stored[field] ?? '') !== String(next[field] ?? ''),
  )
  if (changed.length > 0) throw new SecretDestinationChangedError(changed)
}

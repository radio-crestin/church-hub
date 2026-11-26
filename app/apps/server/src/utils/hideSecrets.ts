/** A secret field and the flag that tells only whether it is set. */
export type SecretFlags = Record<string, string>

/**
 * The value without its secret fields, each replaced by a flag saying
 * whether it is set (`{ password: 'passwordSet' }` turns
 * `password: 'x'` into `passwordSet: true`).
 */
export function hideSecrets<T extends object>(
  value: T,
  flags: SecretFlags,
): Record<string, unknown> {
  const visible = { ...value } as Record<string, unknown>
  for (const [field, flag] of Object.entries(flags)) {
    visible[flag] = Boolean(visible[field])
    delete visible[field]
  }
  return visible
}

import { SECRET_NAME, SECRET_VALUE } from './secret-patterns'

/**
 * Returns a copy of a parsed JSON value with every secret set to null:
 * fields whose name looks secret, at any depth, and strings shaped like a key.
 */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, field]) => [
        name,
        SECRET_NAME.test(name) ? null : redactSecrets(field),
      ]),
    )
  }

  if (typeof value === 'string' && SECRET_VALUE.test(value)) return null

  return value
}

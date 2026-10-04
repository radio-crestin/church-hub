import { writeFileSync } from 'node:fs'

import { redactSecrets } from './redact-secrets'

/**
 * Writes a fixture file with every secret-named field and key-shaped value
 * set to null. Every fixture goes through here: fixtures ship to all users.
 */
export function writeFixture(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(redactSecrets(data), null, 2))
}

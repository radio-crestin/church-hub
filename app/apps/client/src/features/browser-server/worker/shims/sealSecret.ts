/**
 * `service/secret-store/sealSecret.ts` in the browser build: a browser keeps
 * its secrets (its login tokens, its device token) as it keeps its whole
 * database, in the browser's own storage for this site; a data key would
 * have to sit right beside them there, so sealing adds nothing. Values are
 * stored as they are, which the server's openSecret reads as unsealed.
 */
export function sealSecret(plain: string, _place: unknown): string {
  return plain
}

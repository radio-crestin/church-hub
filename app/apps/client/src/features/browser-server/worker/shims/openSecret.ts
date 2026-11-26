/**
 * `service/secret-store/openSecret.ts` in the browser build: a browser's
 * database never holds a sealed value (sealSecret.ts stores them as they
 * are, and secrets never travel in sync), so a stored value is the secret.
 */
export function openSecret(stored: string, _place: unknown): string {
  return stored
}

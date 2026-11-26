/**
 * `text` with every church prefix (`churches/<churchId>-<pathSecret>`)
 * replaced by `churches/<redacted>`: the path secret is the read
 * permission, so error messages and logs never carry it.
 */
export function redactChurchPaths(text: string): string {
  return text.replace(/churches\/[A-Za-z0-9_-]+/g, 'churches/<redacted>')
}

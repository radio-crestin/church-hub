/** `churches/<churchId>-<pathSecret>`: knowing it is the read permission. */
export function churchPrefix(churchId: string, pathSecret: string): string {
  return `churches/${churchId}-${pathSecret}`
}

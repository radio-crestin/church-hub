/**
 * `text` with every church prefix (`churches/<churchId>-<pathSecret>`, also
 * percent-encoded as `churches%2F…`, in any case) replaced by
 * `churches/<redacted>`: the path secret is the read permission, so logs
 * never carry it. A second net: storage errors already leave keys out.
 */
export function redactChurchPaths(text: string): string {
  return text.replace(/churches(?:\/|%2F)[A-Za-z0-9_%-]+/gi, 'churches/<redacted>')
}

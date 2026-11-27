/** A file's URL next to a manifest, refusing paths that leave the manifest's site. */
export function sourceFileUrl(manifestUrl: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const url = new URL(encoded, manifestUrl)
  if (url.origin !== new URL(manifestUrl).origin) {
    throw new Error(`Song path leaves the source: ${path}`)
  }
  return url.toString()
}

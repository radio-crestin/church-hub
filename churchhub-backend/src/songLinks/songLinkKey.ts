/** Where a shared song is kept, in the service's private bucket. */
export function songLinkKey(linkId: string): string {
  return `song-links/${linkId}.json`
}

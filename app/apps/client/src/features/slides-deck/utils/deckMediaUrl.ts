/** Where a deck's picture or video is stored: the backgrounds gallery. */
export function deckMediaUrl(mediaId: string): string {
  return `/api/media/backgrounds/${encodeURIComponent(mediaId)}`
}

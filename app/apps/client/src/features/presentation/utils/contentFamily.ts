import type { ContentType } from '../types'

/** A song's first, middle and last slides are one family: they change as slides. */
export function contentFamily(contentType: ContentType): string {
  return contentType.startsWith('song') ? 'song' : contentType
}

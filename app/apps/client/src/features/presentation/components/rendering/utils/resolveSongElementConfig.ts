import type {
  ContentTypeConfig,
  ReferenceTextConfig,
  SongContentConfig,
} from '../../../types'

type SongElementName = 'songKey' | 'amen'

/**
 * The layout of the song key ("gama") or the "Amin" for the slide on screen.
 * The first / last slide layouts each hold only their own element, so jumping
 * from one to the other would drop the element at once. Falling back to the
 * plain song layout keeps it mounted, so it fades out with the lyrics.
 */
export function resolveSongElementConfig(
  config: ContentTypeConfig | undefined,
  songConfig: SongContentConfig | null | undefined,
  name: SongElementName,
): ReferenceTextConfig | undefined {
  const own =
    config && name in config
      ? (config as Partial<Record<SongElementName, ReferenceTextConfig>>)[name]
      : undefined
  return own ?? songConfig?.[name]
}

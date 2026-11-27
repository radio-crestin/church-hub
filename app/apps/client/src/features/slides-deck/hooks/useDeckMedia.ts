import {
  type MediaSource,
  useMediaUrl,
} from '~/features/background-media/hooks/useMediaUrl'
import { deckMediaUrl } from '../utils/deckMediaUrl'

/** A deck picture's or video's URL the page can load (useMediaUrl). */
export function useDeckMedia(mediaId: string | undefined): MediaSource {
  return useMediaUrl(mediaId ? deckMediaUrl(mediaId) : null)
}

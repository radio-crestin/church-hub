import { usePresentationState } from '~/features/presentation/hooks/usePresentationState'

/** The id of the gallery image or video on the screens now, if one is. */
export function useLiveGalleryMediaId(): string | null {
  const { data: state } = usePresentationState()
  const content = state?.temporaryContent
  if (!content || state.isHidden) return null
  if (content.type !== 'image' && content.type !== 'video') return null
  return content.data.mediaId
}

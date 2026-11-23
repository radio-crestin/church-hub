import type {
  PresentationState,
  TemporaryVerseteTineriContent,
} from '~/features/presentation/types'

/**
 * The Marcaje slideshow on screen, if one is: a shown Versete Biblice slide
 * that no program started (programs set `scheduleId`).
 */
export function getBookmarkSlideshow(
  state: PresentationState | undefined,
): TemporaryVerseteTineriContent | null {
  const content = state?.temporaryContent
  return !state?.isHidden &&
    content?.type === 'versete_tineri' &&
    content.data.scheduleId === undefined
    ? content.data
    : null
}

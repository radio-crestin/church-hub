import type {
  PresentationState,
  TemporaryVerseteTineriContent,
} from '~/features/presentation/types'

/**
 * The verse slideshow on screen, if one is: a shown Versete Biblice slide that
 * no program started (programs set `scheduleId`). With `slideshow`, only the
 * one that list started (`bookmarks`, `topic:<id>`).
 */
export function getVerseSlideshow(
  state: PresentationState | undefined,
  slideshow?: string,
): TemporaryVerseteTineriContent | null {
  const content = state?.temporaryContent
  if (
    state?.isHidden ||
    content?.type !== 'versete_tineri' ||
    content.data.scheduleId !== undefined
  ) {
    return null
  }
  return slideshow === undefined || content.data.slideshow === slideshow
    ? content.data
    : null
}

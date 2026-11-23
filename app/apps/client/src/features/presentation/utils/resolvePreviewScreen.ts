import type { Screen } from '../types'

type PreviewCandidate = Pick<
  Screen,
  'id' | 'type' | 'sortOrder' | 'isPreviewScreen'
>

/**
 * The screen every operator-side preview mirrors:
 * 1. the screen chosen as "shown in the previews" (one at a time, server-side)
 * 2. otherwise the main projector screen (first primary, by sort order), which
 *    is also where the previews land when the chosen screen is deleted
 * 3. otherwise the first screen, so a setup with no primary still shows one
 */
export function resolvePreviewScreen<T extends PreviewCandidate>(
  screens: T[] | undefined,
): T | null {
  if (!screens?.length) return null
  const chosen = screens.find((s) => s.isPreviewScreen)
  if (chosen) return chosen
  const bySortOrder = [...screens].sort((a, b) => a.sortOrder - b.sortOrder)
  return bySortOrder.find((s) => s.type === 'primary') ?? bySortOrder[0]
}

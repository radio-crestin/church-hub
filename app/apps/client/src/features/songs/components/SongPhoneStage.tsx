import { Eraser, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  ContentTypeButton,
  LivePreview,
  usePresentationState,
  useWebSocket,
} from '~/features/presentation'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '~/features/presentation/hooks/useSlideHighlights'
import type { TemporaryContent } from '~/features/presentation/types'
import { LiveBadge } from './LiveBadge'
import { PreviewModeToggle } from './PreviewModeToggle'

interface SongPhoneStageProps {
  songId: number
  previewMode: boolean
  onTogglePreviewMode: () => void
  /** Staged content shown in the preview while not yet projected. */
  previewContent: TemporaryContent | null
  hideBackground: boolean
}

/**
 * The song page's preview on a phone, pinned at the top while the verses
 * scroll under it (see WorkspaceTabs). Once the page scrolls it shrinks to a
 * thumbnail beside what is live, so it never leaves the screen. Previous,
 * hide and next sit at the bottom instead (SongPhoneControls).
 */
export function SongPhoneStage({
  songId,
  previewMode,
  onTogglePreviewMode,
  previewContent,
  hideBackground,
}: SongPhoneStageProps) {
  const { t } = useTranslation(['songs', 'bible'])
  useWebSocket()
  const { data: state } = usePresentationState()
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()

  const content = state?.temporaryContent
  const isLive =
    !(state?.isHidden ?? true) &&
    content?.type === 'song' &&
    content.data.songId === songId

  return (
    <div
      data-testid="song-phone-stage"
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 group-data-[stuck=true]/pinned:hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {content && <ContentTypeButton temporaryContent={content} />}
          {highlights && highlights.length > 0 && (
            <button
              type="button"
              onClick={() => clearHighlights.mutate()}
              disabled={clearHighlights.isPending}
              className="flex items-center p-1.5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 shrink-0"
              aria-label={t('bible:controls.clearHighlights')}
            >
              {clearHighlights.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Eraser size={16} />
              )}
            </button>
          )}
        </div>
        <LiveBadge isLive={isLive} />
        <PreviewModeToggle
          previewMode={previewMode}
          onTogglePreviewMode={onTogglePreviewMode}
        />
      </div>
      <div className="flex items-center gap-3 p-2">
        <div className="w-full shrink-0 transition-[width] duration-200 group-data-[stuck=true]/pinned:w-2/5">
          <LivePreview
            previewContent={previewContent}
            hideBackground={hideBackground}
          />
        </div>
        <div className="hidden min-w-0 flex-1 flex-col items-start gap-2 group-data-[stuck=true]/pinned:flex [&>*]:max-w-full">
          <LiveBadge isLive={isLive} />
          {content && <ContentTypeButton temporaryContent={content} />}
        </div>
      </div>
    </div>
  )
}

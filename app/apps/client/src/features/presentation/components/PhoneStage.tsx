import { Eraser, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ContentTypeButton } from './ContentTypeButton'
import { LiveBadge } from './LiveBadge'
import { LivePreview } from './LivePreview'
import { PreviewScreenPicker } from './PreviewScreenPicker'
import { usePresentationState } from '../hooks/usePresentationState'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '../hooks/useSlideHighlights'
import { useWebSocket } from '../hooks/useWebSocket'
import type { TemporaryContent } from '../types'

interface PhoneStageProps {
  /** What this page shows is on the screens: the LIVE chip lights up. */
  isLive: boolean
  testId: string
  /** The page's own switches beside the LIVE chip (the song's Preview mode). */
  headerActions?: ReactNode
  /** Staged content shown in the preview while not yet projected. */
  previewContent?: TemporaryContent | null
  hideBackground?: boolean
}

/**
 * A page's preview on a phone, pinned at the top while the page scrolls under
 * it (see WorkspaceTabs). Once the page scrolls it shrinks to a thumbnail
 * beside what is live, so it never leaves the screen. Previous, hide and next
 * sit at the bottom instead (PhoneSlideControls).
 */
export function PhoneStage({
  isLive,
  testId,
  headerActions,
  previewContent,
  hideBackground,
}: PhoneStageProps) {
  const { t } = useTranslation('bible')
  useWebSocket()
  const { data: state } = usePresentationState()
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()

  const content = state?.temporaryContent

  return (
    <div
      data-testid={testId}
      className="bg-panel rounded-xl border border-line overflow-hidden"
    >
      <div className="flex items-center gap-2 p-2 border-b border-line group-data-[stuck=true]/pinned:hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {content && <ContentTypeButton temporaryContent={content} />}
          {highlights && highlights.length > 0 && (
            <button
              type="button"
              onClick={() => clearHighlights.mutate()}
              disabled={clearHighlights.isPending}
              className="flex items-center justify-center h-8 w-8 text-fg-label rounded-lg hover:bg-hover hover:text-fg disabled:opacity-50 shrink-0"
              aria-label={t('controls.clearHighlights')}
            >
              {clearHighlights.isPending ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Eraser size={16} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
        <LiveBadge isLive={isLive} />
        {headerActions}
        <PreviewScreenPicker placement="down" />
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

import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  EyeOff,
  Loader2,
  MonitorUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  ContentTypeButton,
  LiveBadge,
  LivePreview,
  usePresentationState,
  useWebSocket,
} from '~/features/presentation'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '~/features/presentation/hooks/useSlideHighlights'
import type { TemporaryContent } from '~/features/presentation/types'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { PreviewModeToggle } from './PreviewModeToggle'

interface SongControlPanelProps {
  songId: number
  /**
   * Owned by the route, which knows whether the projector is walking a program
   * (next crosses into the item after the song) or just this song.
   */
  onPrevSlide: () => void
  onNextSlide: () => void
  canNavigatePrev: boolean
  canNavigateNext: boolean
  isNavigating?: boolean
  /** Preview mode: stage a slide locally before projecting it. */
  previewMode: boolean
  onTogglePreviewMode: () => void
  /** Staged content shown in the local stage while not yet projected. */
  previewContent: TemporaryContent | null
  /** Whether there is a staged slide that can be projected. */
  canProject: boolean
  /** Projects the staged slide (Afișează / Project). */
  onProject: () => void
  isProjecting?: boolean
  /** Hides the projection (Ascunde). Owned by the route so Preview mode can
   *  retain the staged text in the local stage after hiding. */
  onHide: () => void
  isHiding?: boolean
  /**
   * Plain black behind the lyrics in the preview (never on the screens). Set
   * from the song page's "More" menu.
   */
  hideBackground: boolean
}

export function SongControlPanel({
  songId,
  onPrevSlide,
  onNextSlide,
  canNavigatePrev,
  canNavigateNext,
  isNavigating = false,
  previewMode,
  onTogglePreviewMode,
  previewContent,
  canProject,
  onProject,
  isProjecting = false,
  onHide,
  isHiding = false,
  hideBackground,
}: SongControlPanelProps) {
  const { t } = useTranslation(['songs', 'bible'])

  useWebSocket()

  const { data: state } = usePresentationState()

  // Highlight management
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  // Check if this song is currently being presented
  const isTemporarySongActive =
    state?.temporaryContent?.type === 'song' &&
    state.temporaryContent.data.songId === songId

  const isHidden = state?.isHidden ?? true
  const isLive = !isHidden && isTemporarySongActive

  return (
    <div className="flex flex-col lg:h-full bg-panel rounded-xl border border-line overflow-hidden">
      {/* Header — two logical groups so the controls breathe instead of
          crowding together:
            • Status group:   content-type chip + clear-highlights · LIVE chip
            • Controls group: Preview-mode toggle · primary action
          On large screens both sit on one line separated by a divider; on
          small screens they stack into two rows. The primary action is a
          single slot: Afișează (project a staged slide), Ascunde (hide the live
          one), or a disabled Afișează when Preview is off and nothing is live —
          they're mutually exclusive, so only one ever shows. */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 p-2 lg:p-3 border-b border-line overflow-hidden">
        {/* Status group */}
        <div className="flex items-center gap-2 min-w-0 lg:flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {state?.temporaryContent && (
              <ContentTypeButton temporaryContent={state.temporaryContent} />
            )}
            {hasHighlights && (
              <button
                type="button"
                onClick={() => clearHighlights.mutate()}
                disabled={clearHighlights.isPending}
                className="flex h-8 w-8 items-center justify-center text-fg-label rounded-lg hover:bg-hover hover:text-fg disabled:opacity-50 transition-colors shrink-0"
                title={t('bible:controls.clearHighlights')}
              >
                {clearHighlights.isPending ? (
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                ) : (
                  <Eraser size={16} strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>
          <LiveBadge isLive={isLive} />
        </div>

        {/* Divider between the two groups — large screens only, where both
            groups share a single line. */}
        <div
          aria-hidden="true"
          className="hidden lg:block w-px self-stretch bg-line"
        />

        {/* Controls group */}
        <div className="flex items-center justify-between gap-3 lg:justify-end shrink-0">
          {/* Live / preview: how a click on a verse behaves. */}
          <PreviewModeToggle
            previewMode={previewMode}
            onTogglePreviewMode={onTogglePreviewMode}
          />

          {isLive ? (
            <button
              type="button"
              onClick={onHide}
              disabled={isHiding}
              className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-hover rounded-lg disabled:opacity-50 transition-colors shrink-0"
              title={`${t('bible:controls.hide')} (Esc)`}
            >
              {isHiding ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <EyeOff size={16} strokeWidth={1.5} />
              )}
              <span>{t('bible:controls.hide')}</span>
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
          ) : previewMode ? (
            canProject ? (
              <button
                type="button"
                data-testid="song-project-staged"
                onClick={onProject}
                disabled={isProjecting}
                className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium text-white bg-primary hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors shrink-0"
                title={t('preview.projectHint')}
              >
                {isProjecting ? (
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                ) : (
                  <MonitorUp size={16} strokeWidth={1.5} />
                )}
                <span>{t('preview.project')}</span>
              </button>
            ) : null
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-hover rounded-lg opacity-50 cursor-not-allowed shrink-0"
            >
              <MonitorUp size={16} strokeWidth={1.5} />
              <span>{t('bible:controls.show')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-2 lg:p-3 lg:flex-1 lg:min-h-0 flex flex-col lg:justify-center lg:[container-type:size] [--preview-reserve:3.75rem]">
        {/* The preview fits the panel both ways (LivePreview reads the size
            container), and with the controls it sits centred in the panel. */}
        <div className="w-full flex-shrink-0">
          <LivePreview
            previewContent={previewContent}
            hideBackground={hideBackground}
          />
        </div>

        <div className="flex items-center justify-center gap-2 pt-3 flex-shrink-0">
          <button
            type="button"
            // Ignore presses while a move is in flight instead of dimming the
            // button, which made it flicker on every press.
            onClick={() => !isNavigating && onPrevSlide()}
            disabled={!canNavigatePrev || isHiding}
            className="flex items-center gap-2 h-9 px-3.5 bg-field text-fg rounded-lg hover:bg-hover disabled:opacity-50 transition-colors"
            title={t('bible:controls.prev')}
            data-testid="song-control-prev"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
            <span className="text-sm font-medium">
              {t('bible:controls.prev')}
            </span>
          </button>

          <button
            type="button"
            // Ignore presses while a move is in flight instead of dimming the
            // button, which made it flicker on every press.
            onClick={() => !isNavigating && onNextSlide()}
            disabled={!canNavigateNext || isHiding}
            className="flex items-center gap-2 h-9 px-3.5 bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            title={t('bible:controls.next')}
            data-testid="song-control-next"
          >
            <span className="text-sm font-medium">
              {t('bible:controls.next')}
            </span>
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}

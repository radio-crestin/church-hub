import { Eraser, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '~/features/keyboard-shortcuts'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { PageHeader } from '~/ui/page'
import { ContentTypeButton } from './ContentTypeButton'
import { LivePreview } from './LivePreview'
import { PhoneSlideControls } from './PhoneSlideControls'
import {
  type LiveProgramSteps,
  useClearSlide,
  useClearTemporaryContent,
  useMoveLive,
  usePresentationState,
  useShowSlide,
} from '../hooks'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '../hooks/useSlideHighlights'
import { ScreenShareButton } from '../screen-share'
import type { ClockOverride } from '../types'

// The operators read the time from the Control Room, so its clock is large and
// always shown — also where a church hid the clock on the projected screen,
// whose settings stay exactly as they chose them.
const CONTROL_ROOM_CLOCK: ClockOverride = {
  fontFamily: 'Times New Roman',
  fontSize: 140,
}

const HEADER_BUTTON_CLASS =
  'flex items-center gap-1.5 h-8 px-3 text-sm font-medium text-fg bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] rounded-lg hover:bg-hover disabled:opacity-50 transition-colors'
const ICON_BUTTON_CLASS =
  'flex items-center justify-center h-8 w-8 rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50 transition-colors'

interface ControlRoomProps {
  /** The program whose step is on the screens: the phone's arrows walk it. */
  liveProgram: LiveProgramSteps | null
}

export function ControlRoom({ liveProgram }: ControlRoomProps) {
  const { t } = useTranslation(['presentation', 'common'])
  // A phone has no arrow keys: previous, hide and next sit at the bottom.
  const isPhone = !useMediaQuery('(min-width: 1024px)')
  const { goNext, goPrev, isMoving } = useMoveLive(liveProgram)

  const { data: state } = usePresentationState()
  const clearSlide = useClearSlide()
  const showSlideCommand = useShowSlide()
  const clearTemporary = useClearTemporaryContent()

  // Get configured showSlide shortcut for display
  const { shortcuts } = useAppShortcuts()
  const showSlideShortcut = useMemo(() => {
    const action = shortcuts.actions.showSlide
    return action?.enabled && action.shortcuts.length > 0
      ? action.shortcuts[0]
      : undefined
  }, [shortcuts])

  // Highlight management (auto-clear is handled globally in AppLayout)
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  // Check if we have temporary content
  const hasTemporaryContent = !!state?.temporaryContent
  const isHidden = state?.isHidden ?? true

  // Show = display the last slide
  const handleShow = async () => {
    if (state?.lastSongSlideId) {
      await showSlideCommand.mutateAsync()
    }
  }

  // Hide = clear current slide
  const handleHide = async () => {
    if (hasTemporaryContent) {
      await clearTemporary.mutateAsync()
    } else {
      await clearSlide.mutateAsync()
    }
  }

  const hasContent = hasTemporaryContent || !!state?.lastSongSlideId

  // What the LIVE lamp reports: something is on the projection right now.
  //
  // It used to read `!isHidden` alone, which is whether the projection is
  // *unhidden* — not the same thing. Stopping the content leaves the screen
  // unhidden with nothing on it, so the lamp stayed red over a blank
  // projection. `currentSongSlideId` is the slide showing at this moment
  // (hiding moves it to `lastSongSlideId`), so together with the temporary
  // content it is exactly what an operator is looking at.
  const isLive =
    !isHidden && (hasTemporaryContent || !!state?.currentSongSlideId)

  // Render content button based on what's being presented
  const renderContentButton = () => {
    const temporaryContent = state?.temporaryContent
    if (!temporaryContent || isHidden) return null

    return <ContentTypeButton temporaryContent={temporaryContent} />
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title={t('presentation:controlRoom.title')}
        actions={<ScreenShareButton />}
      />

      {/* Preview Section */}
      <div className="bg-panel rounded-xl border border-line p-3 lg:p-4 lg:flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0 gap-4">
          {/* LEFT: Content Button */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {renderContentButton()}
          </div>

          {/* RIGHT: LIVE + Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* LIVE Indicator */}
            <div
              data-testid="control-room-live"
              data-live={isLive ? 'true' : 'false'}
              className="flex items-center gap-1.5 h-8 px-2"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? 'bg-live' : 'bg-fg-hint'
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  isLive ? 'text-live' : 'text-fg-hint'
                }`}
              >
                LIVE
              </span>
            </div>
            {/* Clear Highlights Button */}
            {hasHighlights && (
              <button
                type="button"
                onClick={() => clearHighlights.mutate()}
                disabled={clearHighlights.isPending}
                className={ICON_BUTTON_CLASS}
                title={t('presentation:controls.clearHighlights')}
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
            {/* Hide/Show Button (on a phone, in the bottom bar) */}
            {isPhone ? null : !isHidden ? (
              <button
                type="button"
                onClick={handleHide}
                disabled={clearSlide.isPending || clearTemporary.isPending}
                className={HEADER_BUTTON_CLASS}
                title={`${t('presentation:controls.hide')} (Esc)`}
              >
                {clearSlide.isPending || clearTemporary.isPending ? (
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                ) : (
                  <EyeOff size={16} strokeWidth={1.5} />
                )}
                <span>{t('presentation:controls.hide')}</span>
                <KeyboardShortcutBadge shortcut="Escape" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleShow}
                disabled={!hasContent || showSlideCommand.isPending}
                className={HEADER_BUTTON_CLASS}
                title={t('presentation:controls.show')}
              >
                {showSlideCommand.isPending ? (
                  <Loader2
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                ) : (
                  <Eye size={16} strokeWidth={1.5} />
                )}
                <span>{t('presentation:controls.show')}</span>
                {showSlideShortcut && (
                  <KeyboardShortcutBadge shortcut={showSlideShortcut} />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="lg:flex-1 flex items-center justify-center min-h-0 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center">
            <LivePreview clockOverride={CONTROL_ROOM_CLOCK} />
          </div>
        </div>
      </div>

      {isPhone && (
        <PhoneSlideControls
          testId="control-room-phone"
          keepsTabBar
          onPrev={goPrev}
          onNext={goNext}
          canPrev={hasTemporaryContent && !isHidden}
          canNext={hasTemporaryContent && !isHidden}
          isNavigating={isMoving}
          isLive={isLive}
          onHide={handleHide}
          isHiding={clearSlide.isPending || clearTemporary.isPending}
          project={
            isHidden && !!state?.lastSongSlideId
              ? { onClick: handleShow, isPending: showSlideCommand.isPending }
              : undefined
          }
        />
      )}
    </div>
  )
}

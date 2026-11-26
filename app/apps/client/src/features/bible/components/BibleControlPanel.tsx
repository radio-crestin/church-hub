import { useNavigate } from '@tanstack/react-router'
import { Eraser, Eye, EyeOff, Loader2, Settings, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '~/features/keyboard-shortcuts'
import {
  ContentTypeButton,
  LivePreview,
  usePresentationState,
  useShowSlide,
  useWebSocket,
} from '~/features/presentation'
import { PreviewNavControls } from '~/features/presentation/components/PreviewNavControls'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '~/features/presentation/hooks/useSlideHighlights'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { ActionMenu } from '~/ui/menu'
import { useAutoPresentOnSelect } from '../hooks/useAutoPresentOnSelect'

interface BibleControlPanelProps {
  onPrevVerse: () => void
  onNextVerse: () => void
  canNavigate: boolean
  onHide: () => Promise<void>
  isHiding?: boolean
}

export function BibleControlPanel({
  onPrevVerse,
  onNextVerse,
  canNavigate,
  onHide,
  isHiding = false,
}: BibleControlPanelProps) {
  const { t } = useTranslation('bible')
  const navigate = useNavigate()
  const autoPresent = useAutoPresentOnSelect()

  useWebSocket()

  const { data: state } = usePresentationState()
  const showSlideCommand = useShowSlide()

  // Get configured showSlide shortcut for display
  const { shortcuts } = useAppShortcuts()
  const showSlideShortcut = useMemo(() => {
    const action = shortcuts.actions.showSlide
    return action?.enabled && action.shortcuts.length > 0
      ? action.shortcuts[0]
      : undefined
  }, [shortcuts])

  // Highlight management
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  const isHidden = state?.isHidden ?? true
  const hasContent = !!state?.currentSongSlideId || !!state?.lastSongSlideId

  const handleShow = async () => {
    if (state?.lastSongSlideId) {
      await showSlideCommand.mutateAsync()
    }
  }

  const handleHide = async () => {
    await onHide()
  }

  return (
    <div className="flex flex-col lg:h-full bg-panel rounded-xl border border-line">
      {/* Header — the title chip is the only elastic part: it shrinks and
          ellipsises so the LIVE badge and the hide button never get pushed out
          of the panel, however long the song title or passage reference is. */}
      <div className="flex items-center justify-between gap-2 p-2 lg:p-3 border-b border-line overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {state?.temporaryContent && (
            <ContentTypeButton temporaryContent={state.temporaryContent} />
          )}
          {hasHighlights && (
            <button
              type="button"
              onClick={() => clearHighlights.mutate()}
              disabled={clearHighlights.isPending}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-fg-label rounded-lg border border-line hover:bg-hover disabled:opacity-50 transition-colors shrink-0"
              title={t('controls.clearHighlights')}
            >
              {clearHighlights.isPending ? (
                <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
              ) : (
                <Eraser size={16} strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span
              className={`w-2 h-2 rounded-full ${
                !isHidden ? 'bg-live' : 'bg-line-strong'
              }`}
            />
            <span
              className={`text-xs font-semibold ${
                !isHidden ? 'text-live' : 'text-fg-hint'
              }`}
            >
              LIVE
            </span>
          </div>
          {!isHidden ? (
            <button
              type="button"
              onClick={handleHide}
              disabled={isHiding}
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-fg-body rounded-lg border border-line hover:bg-hover disabled:opacity-50 transition-colors"
              title={`${t('controls.hide')} (Esc)`}
            >
              {isHiding ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <EyeOff size={18} />
              )}
              <span className="hidden sm:inline">{t('controls.hide')}</span>
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShow}
              disabled={!hasContent || showSlideCommand.isPending}
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-fg-body rounded-lg border border-line hover:bg-hover disabled:opacity-50 transition-colors"
              title={t('controls.showHint')}
              aria-label={t('controls.show')}
            >
              {showSlideCommand.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Eye size={18} />
              )}
              <span className="hidden sm:inline">{t('controls.show')}</span>
              {showSlideShortcut && (
                <KeyboardShortcutBadge
                  shortcut={showSlideShortcut}
                  variant="muted"
                  className="hidden sm:inline-block"
                />
              )}
            </button>
          )}
          <ActionMenu
            label={t('controls.settings')}
            testId="bible-preview-settings"
            size="compact"
            align="end"
            items={[
              {
                id: 'auto-present',
                label: t('settings.autoPresent.label'),
                description: t('settings.autoPresent.description'),
                icon: <Zap size={16} strokeWidth={1.5} />,
                active: autoPresent.enabled,
                onSelect: () => autoPresent.setEnabled(!autoPresent.enabled),
                testId: 'bible-preview-auto-present',
              },
              {
                id: 'bible-settings',
                label: t('controls.bibleSettings'),
                icon: <Settings size={16} strokeWidth={1.5} />,
                onSelect: () => navigate({ to: '/settings/bible' }),
              },
            ]}
          />
        </div>
      </div>

      <div className="p-2 lg:p-3 lg:flex-1 lg:min-h-0 flex flex-col lg:justify-center lg:[container-type:size] [--preview-reserve:3.75rem]">
        <div className="w-full flex-shrink-0">
          <LivePreview />
        </div>

        <PreviewNavControls
          onPrev={onPrevVerse}
          onNext={onNextVerse}
          canPrev={canNavigate}
          canNext={canNavigate}
          prevTitle={t('controls.prevVerse')}
          nextTitle={t('controls.nextVerse')}
        />
      </div>
    </div>
  )
}

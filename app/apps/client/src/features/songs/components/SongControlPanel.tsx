import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ContentTypeButton,
  LivePreview,
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  useWebSocket,
} from '~/features/presentation'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '~/features/presentation/hooks/useSlideHighlights'
import { KeyboardShortcutBadge } from '~/ui/kbd'

interface SongControlPanelProps {
  songId: number
  onPrevSlide: () => void
  onNextSlide: () => void
  canNavigatePrev: boolean
  canNavigateNext: boolean
  isEditMode: boolean
  onToggleEditMode: () => void
  currentSlideContent?: string
  onEditCurrentSlide?: (content: string) => Promise<void>
}

/**
 * Strip HTML tags and extract plain text content.
 * Uses textContent for safe decoding (no innerHTML with untrusted content).
 */
function stripHtmlTags(html: string): string {
  const textarea = document.createElement('textarea')
  textarea.textContent = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
  return textarea.textContent || ''
}

/**
 * Convert plain text back to HTML paragraphs.
 */
function plainTextToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      return `<p>${escaped || '<br>'}</p>`
    })
    .join('')
}

export function SongControlPanel({
  songId,
  onPrevSlide,
  onNextSlide,
  canNavigatePrev,
  canNavigateNext,
  isEditMode,
  onToggleEditMode,
  currentSlideContent,
  onEditCurrentSlide,
}: SongControlPanelProps) {
  const { t } = useTranslation(['songs', 'bible'])

  useWebSocket()

  const { data: state } = usePresentationState()
  const clearTemporary = useClearTemporaryContent()
  const navigateTemporary = useNavigateTemporary()

  // Highlight management
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  // Preview editing state
  const [isEditingPreview, setIsEditingPreview] = useState(false)
  const [previewEditContent, setPreviewEditContent] = useState('')
  const [isPreviewSaving, setIsPreviewSaving] = useState(false)
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Check if this song is currently being presented
  const isTemporarySongActive =
    state?.temporaryContent?.type === 'song' &&
    state.temporaryContent.data.songId === songId

  const isHidden = state?.isHidden ?? true
  const isLive = !isHidden && isTemporarySongActive

  // Close preview edit when edit mode is toggled off
  useEffect(() => {
    if (!isEditMode) {
      setIsEditingPreview(false)
    }
  }, [isEditMode])

  // Focus textarea when preview editing starts
  useEffect(() => {
    if (isEditingPreview && previewTextareaRef.current) {
      previewTextareaRef.current.focus()
      const len = previewTextareaRef.current.value.length
      previewTextareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditingPreview])

  const handleStartPreviewEdit = useCallback(() => {
    if (!currentSlideContent || !onEditCurrentSlide) return
    setPreviewEditContent(stripHtmlTags(currentSlideContent))
    setIsEditingPreview(true)
  }, [currentSlideContent, onEditCurrentSlide])

  const handleCancelPreviewEdit = useCallback(() => {
    setIsEditingPreview(false)
    setPreviewEditContent('')
  }, [])

  const handleSavePreviewEdit = useCallback(async () => {
    if (!onEditCurrentSlide) return
    setIsPreviewSaving(true)
    try {
      await onEditCurrentSlide(plainTextToHtml(previewEditContent))
      setIsEditingPreview(false)
      setPreviewEditContent('')
    } finally {
      setIsPreviewSaving(false)
    }
  }, [previewEditContent, onEditCurrentSlide])

  const handleHide = async () => {
    await clearTemporary.mutateAsync()
  }

  const handlePrev = async () => {
    if (isTemporarySongActive) {
      await navigateTemporary.mutateAsync({ direction: 'prev' })
    } else {
      onPrevSlide()
    }
  }

  const handleNext = async () => {
    if (isTemporarySongActive) {
      await navigateTemporary.mutateAsync({ direction: 'next' })
    } else {
      onNextSlide()
    }
  }

  return (
    <div className="flex flex-col lg:h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-2 lg:p-3 border-b border-gray-200 dark:border-gray-700">
        {/* Left side - Content type button, edit mode toggle, and clear highlights */}
        <div className="flex items-center gap-2">
          {state?.temporaryContent && (
            <ContentTypeButton temporaryContent={state.temporaryContent} />
          )}
          <button
            type="button"
            onClick={onToggleEditMode}
            className={`flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              isEditMode
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600'
                : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={
              isEditMode
                ? t('songs:preview.exitEditMode')
                : t('songs:preview.editMode')
            }
          >
            <Pencil size={16} />
            <span className="hidden sm:inline">
              {isEditMode
                ? t('songs:preview.exitEditMode')
                : t('songs:preview.editMode')}
            </span>
          </button>
          {hasHighlights && (
            <button
              type="button"
              onClick={() => clearHighlights.mutate()}
              disabled={clearHighlights.isPending}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={t('bible:controls.clearHighlights')}
            >
              {clearHighlights.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Eraser size={16} />
              )}
            </button>
          )}
        </div>
        {/* Right side - LIVE indicator and controls */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
              isLive
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-gray-400 dark:bg-gray-500'
              }`}
            />
            <span
              className={`text-xs font-semibold ${
                isLive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              LIVE
            </span>
          </div>
          {isLive ? (
            <button
              type="button"
              onClick={handleHide}
              disabled={clearTemporary.isPending}
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={`${t('bible:controls.hide')} (Esc)`}
            >
              {clearTemporary.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <EyeOff size={18} />
              )}
              <span className="hidden sm:inline">
                {t('bible:controls.hide')}
              </span>
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
            >
              <Eye size={18} />
              <span className="hidden sm:inline">
                {t('bible:controls.show')}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="p-2 lg:p-3 lg:flex-1 lg:min-h-0 flex flex-col">
        {/* Preview area with optional edit overlay */}
        <div className="w-full flex-shrink-0 relative">
          <LivePreview />
          {/* Edit overlay for preview - appears when edit mode + slide presented */}
          {isEditMode && currentSlideContent && onEditCurrentSlide && (
            <>
              {isEditingPreview ? (
                <div className="absolute inset-0 flex flex-col bg-gray-900/95 rounded-lg p-3 animate-in fade-in duration-200">
                  <textarea
                    ref={previewTextareaRef}
                    value={previewEditContent}
                    onChange={(e) => setPreviewEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCancelPreviewEdit()
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                        handleSavePreviewEdit()
                    }}
                    className="flex-1 w-full bg-transparent text-white text-sm font-mono resize-none focus:outline-none placeholder-gray-500"
                    placeholder={t('songs:preview.editPreview')}
                  />
                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={handleCancelPreviewEdit}
                      disabled={isPreviewSaving}
                      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePreviewEdit}
                      disabled={isPreviewSaving}
                      className="p-1.5 rounded text-green-400 hover:text-green-300 hover:bg-green-900/30 disabled:opacity-50 transition-colors"
                    >
                      {isPreviewSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartPreviewEdit}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 rounded-lg transition-colors group cursor-pointer"
                >
                  <span className="opacity-0 group-hover:opacity-100 flex items-center gap-2 px-3 py-2 bg-gray-900/80 rounded-lg text-white text-sm transition-opacity">
                    <Pencil size={14} />
                    {t('songs:preview.editPreview')}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-3 flex-shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            disabled={
              !canNavigatePrev ||
              navigateTemporary.isPending ||
              clearTemporary.isPending
            }
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('bible:controls.prev')}
          >
            <ChevronLeft size={20} />
            <span className="text-base">{t('bible:controls.prev')}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={
              !canNavigateNext ||
              navigateTemporary.isPending ||
              clearTemporary.isPending
            }
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('bible:controls.next')}
          >
            <span className="text-base">{t('bible:controls.next')}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

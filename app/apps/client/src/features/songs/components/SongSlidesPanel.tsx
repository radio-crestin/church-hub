import {
  AArrowDown,
  AArrowUp,
  Check,
  Loader2,
  Pencil,
  Play,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDividerPosition } from '../../../hooks/useDividerPosition'
import type { SongSlide, SongWithSlides } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'
import {
  type MarkdownSlide,
  markdownToSlides,
  slidesToMarkdown,
} from '../utils/slidesMarkdown'
import { stripHtmlTags } from '../utils/stripHtmlTags'

interface SongSlidesPanelProps {
  song: SongWithSlides
  presentedSlideIndex: number | null
  selectedSlideIndex: number
  isLoading: boolean
  isSaving?: boolean
  isEditMode: boolean
  onToggleEditMode: () => void
  /** Whether the current user may edit (songs.edit). Hides the edit toggle. */
  canEdit?: boolean
  onSave?: () => void
  onSlideClick: (slide: SongSlide, index: number) => void
  onApplyText?: (slides: MarkdownSlide[]) => void | Promise<void>
  /** Preview mode: a single click stages instead of projecting. */
  previewMode?: boolean
  /** Index of the slide staged for preview (indigo, not yet projected). */
  stagedSlideIndex?: number | null
  /** Double-click handler (preview mode): projects the slide immediately. */
  onSlideDoubleClick?: (slide: SongSlide, index: number) => void
}

/** Identifies the first line of every non-empty slide block in the text. */
function computeSlideBlocks(
  text: string,
): Array<{ blockIdx: number; line: number }> {
  const lines = text.split('\n')
  const blocks: Array<{ blockIdx: number; line: number }> = []
  let blockIdx = 0
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '---' || trimmed === '') {
      inBlock = false
    } else if (!inBlock) {
      blocks.push({ blockIdx, line: i })
      blockIdx++
      inBlock = true
    }
  }
  return blocks
}

const TEXTAREA_LINE_HEIGHT_PX = 20
const TEXTAREA_PADDING_TOP_PX = 8

const SCROLL_OFFSET_TOP = 100

// Reader-controlled font size for the view-mode lyrics list. The base matches
// Tailwind's `text-sm` (0.875rem); the operator can scale it up/down so the
// whole-song view stays legible at any panel width. Persisted per-device.
const SLIDE_FONT_BASE_REM = 0.875
const SLIDE_FONT_MIN_SCALE = 0.8
const SLIDE_FONT_MAX_SCALE = 2.2
// One press moves the rendered text by exactly 1px at the default 16px root
// size: the base is 0.875rem = 14px, so a 1px step is 1/14 of the base. Kept
// as a division rather than a literal so it stays correct if the base changes.
const ROOT_FONT_SIZE_PX = 16
const SLIDE_FONT_STEP_PX = 1
const SLIDE_FONT_STEP =
  SLIDE_FONT_STEP_PX / (SLIDE_FONT_BASE_REM * ROOT_FONT_SIZE_PX)
const SLIDE_FONT_SCALE_KEY = 'song-slides-font-scale'

// Four decimals, not two: the 1px step is 1/14 (0.0714…), and rounding to two
// would quantise every press to 0.07 — a 2% shortfall that accumulates over
// the ~20 presses between the min and max scale.
function clampFontScale(scale: number): number {
  return Math.min(
    SLIDE_FONT_MAX_SCALE,
    Math.max(SLIDE_FONT_MIN_SCALE, Math.round(scale * 10000) / 10000),
  )
}

// Decode HTML entities the same way the live preview does, so the slide list
// shows real characters (e.g. an apostrophe) instead of raw codes like
// `&#039;`. Setting `textContent` does NOT decode entities, which is why the
// previous textarea-based approach left `&#039;` visible.

export function SongSlidesPanel({
  song,
  presentedSlideIndex,
  selectedSlideIndex,
  isLoading,
  isSaving,
  isEditMode,
  onToggleEditMode,
  canEdit = true,
  onSave,
  onSlideClick,
  onApplyText,
  previewMode = false,
  stagedSlideIndex = null,
  onSlideDoubleClick,
}: SongSlidesPanelProps) {
  const { t } = useTranslation('songs')
  const [fontScaleRaw, setFontScale] = useDividerPosition(
    SLIDE_FONT_SCALE_KEY,
    1,
  )
  const fontScale = clampFontScale(fontScaleRaw)
  const slideTextStyle = useMemo(
    () => ({
      fontSize: `${SLIDE_FONT_BASE_REM * fontScale}rem`,
      lineHeight: 1.4,
    }),
    [fontScale],
  )
  const decreaseFontSize = useCallback(
    () => setFontScale(clampFontScale(fontScale - SLIDE_FONT_STEP)),
    [fontScale, setFontScale],
  )
  const increaseFontSize = useCallback(
    () => setFontScale(clampFontScale(fontScale + SLIDE_FONT_STEP)),
    [fontScale, setFontScale],
  )
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [textValue, setTextValue] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [presentingIdx, setPresentingIdx] = useState<number | null>(null)

  // Sorted original slides — used to seed the textarea on entering edit mode.
  const sortedSlides = useMemo(
    () => [...song.slides].sort((a, b) => a.sortOrder - b.sortOrder),
    [song.slides],
  )

  // Expanded slides for view mode (auto-inserts choruses) and for presenting.
  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(song.slides),
    [song.slides],
  )

  // Index shown in the toolbar counter. Mirrors the row-highlight precedence
  // below: the live (green) slide wins over the staged preview slide, which
  // wins over the keyboard selection. Null when nothing is highlighted.
  const activeSlideIndex = useMemo(() => {
    const index =
      presentedSlideIndex !== null
        ? presentedSlideIndex
        : previewMode
          ? stagedSlideIndex
          : selectedSlideIndex
    if (index === null || index < 0 || index >= expandedSlides.length)
      return null
    return index
  }, [
    presentedSlideIndex,
    previewMode,
    stagedSlideIndex,
    selectedSlideIndex,
    expandedSlides.length,
  ])

  // Track chorus duplicates for view mode
  const isOriginalSlide = useMemo(() => {
    const seen = new Set<number>()
    return expandedSlides.map((slide) => {
      if (seen.has(slide.id)) return false
      seen.add(slide.id)
      return true
    })
  }, [expandedSlides])

  // Auto-scroll to presented slide (view mode)
  useEffect(() => {
    if (!isEditMode && highlightedRef.current && containerRef.current) {
      const container = containerRef.current
      const element = highlightedRef.current
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const elementTop =
        elementRect.top - containerRect.top + container.scrollTop
      const targetScrollTop = Math.max(0, elementTop - SCROLL_OFFSET_TOP)
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
    }
  }, [presentedSlideIndex, isEditMode])

  // Auto-scroll to selected slide (view mode)
  useEffect(() => {
    if (
      !isEditMode &&
      presentedSlideIndex === null &&
      selectedRef.current &&
      containerRef.current
    ) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [selectedSlideIndex, presentedSlideIndex, isEditMode])

  const parsedSlides = useMemo(() => markdownToSlides(textValue), [textValue])

  const slideBlocks = useMemo(() => computeSlideBlocks(textValue), [textValue])

  const applyTextValue = useCallback(async () => {
    if (!onApplyText) return
    await onApplyText(parsedSlides)
  }, [onApplyText, parsedSlides])

  const handleSaveClick = useCallback(async () => {
    await applyTextValue()
    onSave?.()
  }, [applyTextValue, onSave])

  // Seed textarea from sorted slides when entering edit mode; clear on exit.
  useEffect(() => {
    if (isEditMode) {
      setTextValue(slidesToMarkdown(sortedSlides))
      setScrollTop(0)
      setTimeout(() => textareaRef.current?.focus(), 0)
    } else {
      setTextValue('')
      setScrollTop(0)
    }
    // Only re-seed on the edit-mode boundary, not on every slide edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode])

  const handlePresentBlock = useCallback(
    async (blockIdx: number) => {
      setPresentingIdx(blockIdx)
      try {
        await applyTextValue()
        const expanded = expandedSlides[blockIdx]
        onSlideClick(
          expanded ?? ({ ...sortedSlides[0], id: -1 } as SongSlide),
          blockIdx,
        )
      } finally {
        setPresentingIdx(null)
      }
    },
    [applyTextValue, expandedSlides, onSlideClick, sortedSlides],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              data-testid="toggle-slides-edit-mode"
              onClick={onToggleEditMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${
                isEditMode
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                  : 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
            >
              <Pencil size={14} />
              <span>{t('preview.editMode')}</span>
            </button>
          )}
          {!isEditMode && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={decreaseFontSize}
                disabled={fontScale <= SLIDE_FONT_MIN_SCALE}
                title={t('preview.decreaseFontSize')}
                aria-label={t('preview.decreaseFontSize')}
                className="flex items-center justify-center p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AArrowDown size={16} />
              </button>
              <button
                type="button"
                onClick={increaseFontSize}
                disabled={fontScale >= SLIDE_FONT_MAX_SCALE}
                title={t('preview.increaseFontSize')}
                aria-label={t('preview.increaseFontSize')}
                className="flex items-center justify-center p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AArrowUp size={18} />
              </button>
            </div>
          )}
        </div>
        {!isEditMode && expandedSlides.length > 0 && (
          <span
            data-testid="song-slide-counter"
            aria-label={
              activeSlideIndex !== null
                ? t('preview.slideCounterLabel', {
                    current: activeSlideIndex + 1,
                    total: expandedSlides.length,
                  })
                : undefined
            }
            className="shrink-0 text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400"
          >
            {activeSlideIndex !== null
              ? t('preview.slideCounter', {
                  current: activeSlideIndex + 1,
                  total: expandedSlides.length,
                })
              : t('preview.slideCounterTotal', {
                  total: expandedSlides.length,
                })}
          </span>
        )}
        {isEditMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleEditMode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={14} />
              <span>{t('preview.discardChanges')}</span>
            </button>
            <button
              type="button"
              data-testid="save-slides-edit-mode"
              onClick={handleSaveClick}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${
                isSaving
                  ? 'bg-green-200 dark:bg-green-900/60 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 cursor-wait'
                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/60'
              }`}
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              <span>
                {isSaving ? t('preview.saving') : t('preview.exitEditMode')}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Slides */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden lg:overflow-y-auto scrollbar-thin pl-0.5 pr-2 py-0.5"
      >
        {isEditMode ? (
          <div className="flex flex-col gap-2 h-full">
            <div className="relative flex-1 min-h-[200px]">
              <textarea
                ref={textareaRef}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                onBlur={() => {
                  void applyTextValue()
                }}
                placeholder={t('editAsText.placeholder')}
                spellCheck={false}
                style={{
                  lineHeight: `${TEXTAREA_LINE_HEIGHT_PX}px`,
                  paddingTop: `${TEXTAREA_PADDING_TOP_PX}px`,
                  paddingBottom: `${TEXTAREA_PADDING_TOP_PX}px`,
                }}
                className="absolute inset-0 w-full h-full pl-3 pr-16 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm resize-none whitespace-pre"
              />
              {/* Gutter overlay with per-block Play buttons — offset to clear the textarea scrollbar */}
              <div className="pointer-events-none absolute right-5 top-0 bottom-0 w-11 overflow-hidden">
                <div
                  className="relative w-full h-full"
                  style={{ transform: `translateY(${-scrollTop}px)` }}
                >
                  {slideBlocks.map(({ blockIdx, line }) => {
                    const isLive = presentedSlideIndex === blockIdx
                    const isLoading = presentingIdx === blockIdx
                    return (
                      <button
                        key={blockIdx}
                        type="button"
                        disabled={presentingIdx !== null}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          void handlePresentBlock(blockIdx)
                        }}
                        style={{
                          top: `${TEXTAREA_PADDING_TOP_PX + line * TEXTAREA_LINE_HEIGHT_PX}px`,
                          height: `${TEXTAREA_LINE_HEIGHT_PX}px`,
                        }}
                        className={`pointer-events-auto absolute left-1 right-1 flex items-center justify-center gap-0.5 px-1 text-[10px] font-semibold rounded transition-colors ${
                          isLive
                            ? 'bg-green-500 text-white shadow-sm hover:bg-green-600'
                            : 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 shadow-sm'
                        } disabled:opacity-60`}
                        title={t('preview.presentSlide')}
                      >
                        {isLoading ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Play size={10} />
                        )}
                        <span>{blockIdx + 1}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('editAsText.formatHelp')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {expandedSlides.map((slide, index) => {
              const isPresented = index === presentedSlideIndex
              // In preview mode the indigo highlight marks the staged slide
              // (which can coexist with a different live/green slide). Outside
              // preview mode it marks the keyboard-selected slide.
              const isStaged =
                previewMode &&
                stagedSlideIndex !== null &&
                index === stagedSlideIndex &&
                !isPresented
              const isSelected =
                !previewMode &&
                index === selectedSlideIndex &&
                presentedSlideIndex === null
              const isHighlighted = isStaged || isSelected
              const isDuplicate = !isOriginalSlide[index]
              const plainText = stripHtmlTags(slide.content)

              const getButtonClass = () => {
                if (isPresented)
                  return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                if (isHighlighted)
                  return 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
                return 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }

              const getNumberClass = () => {
                if (isPresented) return 'text-green-700 dark:text-green-300'
                if (isHighlighted) return 'text-indigo-700 dark:text-indigo-300'
                return 'text-gray-500 dark:text-gray-400'
              }

              const getTextClass = () => {
                if (isPresented) return 'text-green-900 dark:text-green-100'
                if (isHighlighted) return 'text-indigo-900 dark:text-indigo-100'
                return 'text-gray-700 dark:text-gray-200'
              }

              const getRef = () => {
                if (isPresented) return highlightedRef
                if (isHighlighted) return selectedRef
                return null
              }

              return (
                <button
                  key={`${slide.id}-${index}`}
                  ref={getRef()}
                  type="button"
                  data-testid={`song-slide-${index}`}
                  onClick={() => !isPresented && onSlideClick(slide, index)}
                  onDoubleClick={() =>
                    previewMode &&
                    !isPresented &&
                    onSlideDoubleClick?.(slide, index)
                  }
                  className={`w-full text-left px-2 py-2 rounded-lg transition-colors group ${getButtonClass()} ${
                    isDuplicate ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      style={slideTextStyle}
                      className={`font-semibold min-w-[24px] ${getNumberClass()}`}
                    >
                      {index + 1}
                    </span>
                    <span
                      style={slideTextStyle}
                      className={`whitespace-pre-line flex-1 ${getTextClass()}`}
                    >
                      {plainText}
                    </span>
                    {isDuplicate && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic shrink-0">
                        {t('preview.chorusRepeat')}
                      </span>
                    )}
                  </div>
                  {slide.label && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1 block">
                      {slide.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

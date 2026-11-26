import { Music } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScreenBackgroundConfig } from '~/features/presentation'
import { usePreviewScreen } from '~/features/presentation'
import { usePersistedBoolean } from '~/hooks/usePersistedBoolean'
import { SlideChordEditor } from './SlideChordEditor'
import { SlideLabelSelect } from './SlideLabelSelect'
import type { LocalSlide } from '../../types'
import { plainTextToSlideHtml } from '../../utils/plainTextToSlideHtml'
import { SlideCounter } from '../SlideCounter'
import { SlideNotesPanel } from '../stage-editor/SlideNotesPanel'
import { SlideStyleToolbar } from '../stage-editor/SlideStyleToolbar'
import { SongStageEditor } from '../stage-editor/SongStageEditor'

interface SongSlidesEditorProps {
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
  title: string
  keyLine: string | null
  songId: number | null
  background: ScreenBackgroundConfig | null
}

/**
 * The song's slides edited PowerPoint-style: thumbnails to pick, add, copy,
 * reorder and delete slides, the slide as the screens show it to type on, its
 * formatting bar, and under it the selected slide's label, chords and notes.
 */
export function SongSlidesEditor({
  slides,
  onSlidesChange,
  title,
  keyLine,
  songId,
  background,
}: SongSlidesEditorProps) {
  const { t } = useTranslation('songs')
  const { screen } = usePreviewScreen()
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  // Bumped when the slide's text is rewritten by the formatting bar rather
  // than typed, so the in-place editor takes it.
  const [textVersion, setTextVersion] = useState(0)
  const [chordsOpen, setChordsOpen] = usePersistedBoolean(
    'song-editor:chords-open',
    false,
  )

  const activeIndex =
    slides.length === 0 ? 0 : Math.min(activeSlideIndex, slides.length - 1)
  const active = slides[activeIndex]

  const updateActive = useCallback(
    (patch: Partial<LocalSlide>) => {
      onSlidesChange(
        slides.map((s, i) => (i === activeIndex ? { ...s, ...patch } : s)),
      )
    },
    [slides, activeIndex, onSlidesChange],
  )

  const handleTextChange = useCallback(
    (plainText: string) => {
      updateActive({ content: plainTextToSlideHtml(plainText) })
      setTextVersion((version) => version + 1)
    },
    [updateActive],
  )

  return (
    <SongStageEditor
      slides={slides}
      title={title}
      keyLine={keyLine}
      songId={songId}
      background={background}
      textVersion={textVersion}
      onActiveSlideChange={setActiveSlideIndex}
      onSlidesChange={onSlidesChange}
      canvasToolbar={
        <SlideStyleToolbar
          override={active?.styleOverrides ?? null}
          canvasWidth={screen?.width ?? 1920}
          onChange={(styleOverrides) => updateActive({ styleOverrides })}
          onTextChange={handleTextChange}
          disabled={!active}
        />
      }
      canvasFooter={
        <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 pt-3">
          <SlideCounter
            currentIndex={active ? activeIndex : null}
            total={slides.length}
          />
          <SlideLabelSelect
            label={active?.label}
            onChange={(label) => updateActive({ label })}
            disabled={!active}
          />
          <button
            type="button"
            onClick={() => setChordsOpen(!chordsOpen)}
            aria-pressed={chordsOpen}
            disabled={!active}
            data-testid="slide-chords-toggle"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              chordsOpen
                ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                : 'border-line bg-panel text-fg-label hover:bg-hover'
            }`}
          >
            <Music size={13} />
            {t('songEditor.chords.title')}
            {active?.chords?.length ? (
              <span className="tabular-nums text-amber-600 dark:text-amber-400">
                {active.chords.length}
              </span>
            ) : null}
          </button>
        </div>
      }
      columnFooter={
        <>
          {chordsOpen && active && (
            <div className="mt-2 max-h-56 shrink-0 overflow-y-auto rounded-lg border border-amber-200 bg-panel dark:border-amber-900/50">
              <SlideChordEditor
                content={active.content}
                chords={active.chords}
                onChordsChange={(chords) => updateActive({ chords })}
              />
            </div>
          )}
          <SlideNotesPanel
            slideNumber={activeIndex + 1}
            note={active?.notes ?? ''}
            onChange={(notes) => updateActive({ notes })}
            disabled={!active}
          />
        </>
      }
    />
  )
}

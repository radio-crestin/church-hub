import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SlideNumberGutter } from './SlideNumberGutter'
import type { LocalSlide } from '../../types'
import { findSlideStartLines } from '../../utils/findSlideStartLines'
import { slidesToSongText } from '../../utils/slidesToSongText'
import { songTextToSlides } from '../../utils/songTextToSlides'

/** Pause in typing after which the text is turned back into slides. */
const PARSE_DELAY_MS = 200
const LINE_HEIGHT_PX = 24
const PADDING_TOP_PX = 12
/** Room under the last line for the textarea's own sideways scrollbar. */
const SCROLLBAR_ROOM_PX = 16

interface SongTextEditorProps {
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
}

/**
 * The whole song as one text: a blank line between slides, chords in brackets
 * before their word, `#C1` for a slide's label.
 *
 * Built to stay instant on a long song: the textarea keeps its own text, so a
 * keystroke renders nothing; the slide numbers in the gutter render only when
 * a slide starts or ends; the text is turned back into slides once typing
 * pauses (and when the editor closes), not on every key.
 *
 * The textarea grows with its text and scrolls together with the numbers in
 * one container, so the numbers can never drift from their lines, even in the
 * middle of a fast scroll.
 */
export function SongTextEditor({
  slides,
  onSlidesChange,
}: SongTextEditorProps) {
  const { t } = useTranslation('songs')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [initialText] = useState(() => slidesToSongText(slides))
  const [startLines, setStartLines] = useState(() =>
    findSlideStartLines(initialText),
  )
  const [activeSlide, setActiveSlide] = useState(0)

  // What the parent last had, so an edit is turned into slides against it.
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const onSlidesChangeRef = useRef(onSlidesChange)
  onSlidesChangeRef.current = onSlidesChange
  const startLinesRef = useRef(startLines)
  startLinesRef.current = startLines
  const parsedTextRef = useRef(initialText)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    const text = textareaRef.current?.value
    if (text === undefined || text === parsedTextRef.current) return
    parsedTextRef.current = text
    onSlidesChangeRef.current(songTextToSlides(text, slidesRef.current))
  }, [])

  // Closing the editor (back to the slides) keeps what was typed last.
  useEffect(() => flush, [flush])

  const trackCaret = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const caretLine = countLines(textarea.value, textarea.selectionStart)
    const starts = startLinesRef.current
    let slide = 0
    while (slide + 1 < starts.length && starts[slide + 1] <= caretLine) {
      slide += 1
    }
    setActiveSlide(slide)
  }, [])

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    const text = textarea?.value ?? ''
    if (textarea) textarea.style.height = `${textHeight(text)}px`
    const starts = findSlideStartLines(text)
    if (!sameLines(starts, startLinesRef.current)) setStartLines(starts)
    trackCaret()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, PARSE_DELAY_MS)
  }, [flush, trackCaret])

  return (
    <div
      data-testid="song-text-editor"
      className="flex h-full min-h-[60vh] flex-col gap-2 lg:min-h-0"
    >
      <div
        data-testid="song-text-scroll"
        className="relative flex min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-panel focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/20 scrollbar-thin"
      >
        <div
          aria-hidden
          className="relative w-9 shrink-0 self-stretch border-r border-line bg-field"
        >
          <SlideNumberGutter
            startLines={startLines}
            activeSlide={activeSlide}
            lineHeight={LINE_HEIGHT_PX}
            paddingTop={PADDING_TOP_PX}
          />
        </div>
        <textarea
          ref={textareaRef}
          data-testid="song-text-input"
          defaultValue={initialText}
          onInput={handleInput}
          onSelect={trackCaret}
          onBlur={flush}
          placeholder={t('textEditor.placeholder')}
          spellCheck={false}
          autoFocus
          wrap="off"
          style={{
            height: textHeight(initialText),
            lineHeight: `${LINE_HEIGHT_PX}px`,
            paddingTop: PADDING_TOP_PX,
            paddingBottom: PADDING_TOP_PX,
          }}
          className="min-h-full min-w-0 flex-1 shrink-0 resize-none overflow-x-auto overflow-y-hidden whitespace-pre border-0 bg-transparent px-3 text-[15px] text-fg placeholder:text-fg-hint outline-none focus:ring-0"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-fg-hint">
        <span data-testid="song-text-slide-count" className="tabular-nums">
          {t('textEditor.slideCount', { count: startLines.length })}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <span>{t('textEditor.help.newSlide')}</span>
          <span>
            <code className="text-amber-600 dark:text-amber-400">[G]</code>{' '}
            {t('textEditor.help.chord')}
          </span>
          <span>
            <code className="text-fg">#C1</code> {t('textEditor.help.label')}
          </span>
          <span>
            <code>**{t('textEditor.help.bold')}**</code>
          </span>
        </span>
      </div>
    </div>
  )
}

/** The textarea's height for all of its lines, so it never scrolls itself. */
function textHeight(text: string): number {
  const lines = countLines(text, text.length) + 1
  return lines * LINE_HEIGHT_PX + 2 * PADDING_TOP_PX + SCROLLBAR_ROOM_PX
}

function countLines(text: string, end: number): number {
  let lines = 0
  for (let i = 0; i < end; i += 1) if (text[i] === '\n') lines += 1
  return lines
}

function sameLines(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

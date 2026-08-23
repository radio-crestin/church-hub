import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  RotateCcw,
  Underline,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSlideSelection } from './getSlideSelection'
import {
  measureSlideFontHeadroom,
  measureSlideFontSize,
} from './measureSlideFontSize'
import type { SlideStyleOverride, SlideStyleRange } from '../../types'
import { updateSlideStyleRange } from '../../utils/updateSlideStyleRange'

/**
 * One press of A+/A− moves the size by a tenth, the way PowerPoint's grow/shrink
 * buttons work on a ladder: the screen's own sizes span a wide range, so a fixed
 * step would be imperceptible on one screen and enormous on another.
 */
const FONT_STEP_RATIO = 0.1
const FONT_MIN = 4
const FONT_MAX = 4000

type Alignment = NonNullable<SlideStyleOverride['alignment']>
type Mark = 'bold' | 'italic' | 'underline'
type Selection = { start: number; end: number }

interface SlideStyleToolbarProps {
  /** Styling of the slide on the canvas, or null when it follows the screen. */
  override: SlideStyleOverride | null
  /** Width of the screen in canvas units — what the measured size is scaled by. */
  canvasWidth: number
  /** Called with the new styling, or null to fall back to the screen defaults. */
  onChange: (override: SlideStyleOverride | null) => void
  disabled?: boolean
}

function clampSize(size: number, max: number = FONT_MAX): number {
  return Math.min(max, Math.max(FONT_MIN, Math.round(size)))
}

/** Whether two selections cover the same run. */
function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (a === null || b === null) return a === b
  return a.start === b.start && a.end === b.end
}

/**
 * The styled run the selection starts in, if there is one. A selection can
 * cross several runs; the first is what the controls report, the way the size
 * field reports the first character's size.
 */
function rangeFor(
  override: SlideStyleOverride | null,
  selection: Selection | null,
): SlideStyleRange | undefined {
  if (!selection) return undefined
  return override?.ranges?.find(
    (range) => range.start <= selection.start && selection.start < range.end,
  )
}

/**
 * PowerPoint-style formatting bar above the stage canvas.
 *
 * Everything here is an override on top of the screen's own text settings, so
 * an untouched slide projects exactly as the screen dictates and "restore
 * default" is a matter of dropping the override. With text selected, the size
 * and bold/italic/underline controls act on that selection; with only a caret
 * they act on the whole slide — the same rule PowerPoint uses. Alignment is
 * always a whole-slide property, as it is there.
 *
 * Sizes move in steps from the size on screen, and are stored as a multiplier
 * of the screen's size: that keeps a slide scaling with the screen settings.
 */
export function SlideStyleToolbar({
  override,
  canvasWidth,
  onChange,
  disabled = false,
}: SlideStyleToolbarProps) {
  const { t } = useTranslation('songs')

  // What the operator has selected right now, tracked so the controls report
  // the selection's own formatting the way PowerPoint's ribbon does.
  const [selection, setSelection] = useState<Selection | null>(null)
  useEffect(() => {
    const read = () => {
      const editor = document.querySelector(
        '[data-testid="slide-canvas-editable"]',
      )
      const anchor = window.getSelection()?.anchorNode
      // Clicking into the size input moves the selection out of the slide; the
      // selection it was opened with is what the operator means to restyle, so
      // anything outside the editor leaves the remembered one alone.
      if (!editor || !anchor || !editor.contains(anchor)) return
      const next = getSlideSelection()
      // Applying a size re-seeds the styled markup, which puts the selection
      // back and fires this again. Handing out the same object when the run has
      // not moved keeps that echo from re-measuring the slide and from clearing
      // the guard below — together they used to re-apply the size on every echo,
      // walking it a point at a time with no end.
      setSelection((current) => (sameSelection(current, next) ? current : next))
    }
    read()
    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [])

  const activeRange = rangeFor(override, selection)
  const slideScale = override?.fontScale ?? 1

  // The size actually on the slide right now. Read from the rendered canvas
  // rather than derived from the stored scale, because the text is auto-fitted:
  // the stored scale is a multiplier of a size only the renderer knows.
  const [effectiveSize, setEffectiveSize] = useState(0)
  // The size of the slide itself, which every styled run is a multiple of. A
  // run's size is stored against it rather than against whatever the run
  // happens to be now, so a selection crossing runs of different sizes comes
  // out at one size — the one typed — instead of each run moving by a ratio.
  const [slideSize, setSlideSize] = useState(0)
  // How much bigger the text can get before it leaves the screen. The renderer
  // measures it against the markup it lays out, so it accounts for an enlarged
  // run as well as for the slide's own scale.
  const [headroom, setHeadroom] = useState(1)
  useEffect(() => {
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      // A frame late, so the measurement sees the size the fit just settled on.
      frame = requestAnimationFrame(() => {
        const measured = measureSlideFontSize(canvasWidth, selection)
        if (measured !== null) setEffectiveSize(clampSize(measured))
        const slide = measureSlideFontSize(canvasWidth, null)
        if (slide !== null) setSlideSize(slide)
        setHeadroom(measureSlideFontHeadroom())
      })
    }
    measure()

    // The styled markup is re-seeded and re-fitted after the bar has already
    // rendered with the new override, so a measurement taken then reads the
    // size from before the change — and a second step from it lands on the
    // same number as the first. Measuring again whenever the editor's DOM
    // changes is what keeps the bar describing what is on the canvas.
    const editor = document.querySelector<HTMLElement>(
      '[data-testid="slide-canvas-editable"]',
    )
    const observer = editor ? new MutationObserver(measure) : null
    observer?.observe(editor as HTMLElement, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [canvasWidth, override, selection])

  // The largest size the slide can still show. Growing past it would only
  // inflate a stored multiplier the screen has to cut back down anyway.
  const maxSize =
    effectiveSize > 0
      ? Math.min(FONT_MAX, Math.floor(effectiveSize * headroom))
      : FONT_MAX

  const applySize = useCallback(
    (size: number) => {
      if (effectiveSize <= 0) return
      const target = clampSize(size, maxSize)
      // Nothing to do, and nothing to store: asking for the size that is already
      // rendered would multiply the scale by one and re-render for no reason.
      if (target === effectiveSize) return

      if (selection) {
        // The run is sized against the slide, not against itself: the whole
        // selection gets the typed size whatever each word was before, and
        // the slide's own scale stays put.
        if (slideSize <= 0) return
        onChange(
          updateSlideStyleRange(override, selection, {
            fontScale: target / slideSize,
          }),
        )
        return
      }
      // The slide's scale is a multiplier of a size only the renderer knows, so
      // the new size is expressed as "how much bigger than what is on screen".
      onChange({
        ...override,
        fontScale: slideScale * (target / effectiveSize),
      })
    },
    [
      override,
      onChange,
      selection,
      slideScale,
      slideSize,
      effectiveSize,
      maxSize,
    ],
  )

  const markState = (mark: Mark): boolean =>
    (selection ? activeRange?.[mark] : override?.[mark]) ?? false

  const toggleMark = useCallback(
    (mark: Mark) => {
      const current = markState(mark)
      if (selection) {
        onChange(
          updateSlideStyleRange(override, selection, { [mark]: !current }),
        )
        return
      }
      onChange({ ...override, [mark]: !current })
    },
    [override, onChange, selection, markState],
  )

  const setAlignment = useCallback(
    (alignment: Alignment) => {
      onChange({ ...override, alignment })
    },
    [override, onChange],
  )

  const isCustomized = override !== null

  // Controls must not steal focus from the contentEditable canvas, or the
  // selection they are meant to style is gone by the time they run.
  const keepSelection = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
  }, [])

  const buttonClass = useMemo(
    () => (active: boolean) =>
      `flex items-center justify-center rounded-md border p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'border-indigo-400 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
      }`,
    [],
  )

  return (
    <div
      data-testid="slide-style-toolbar"
      className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        type="button"
        data-testid="slide-style-font-decrease"
        onMouseDown={keepSelection}
        onClick={() => applySize(effectiveSize * (1 - FONT_STEP_RATIO))}
        disabled={disabled}
        title={t('stageEditor.style.decreaseFontSize')}
        aria-label={t('stageEditor.style.decreaseFontSize')}
        className={buttonClass(false)}
      >
        <AArrowDown size={16} />
      </button>
      <button
        type="button"
        data-testid="slide-style-font-increase"
        onMouseDown={keepSelection}
        onClick={() => applySize(effectiveSize * (1 + FONT_STEP_RATIO))}
        disabled={disabled || effectiveSize >= maxSize}
        title={t('stageEditor.style.increaseFontSize')}
        aria-label={t('stageEditor.style.increaseFontSize')}
        className={buttonClass(false)}
      >
        <AArrowUp size={18} />
      </button>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      {(
        [
          ['bold', Bold],
          ['italic', Italic],
          ['underline', Underline],
        ] as const
      ).map(([mark, Icon]) => (
        <button
          key={mark}
          type="button"
          data-testid={`slide-style-${mark}`}
          onMouseDown={keepSelection}
          onClick={() => toggleMark(mark)}
          disabled={disabled}
          aria-pressed={markState(mark)}
          title={t(`stageEditor.style.${mark}`)}
          aria-label={t(`stageEditor.style.${mark}`)}
          className={buttonClass(markState(mark))}
        >
          <Icon size={16} />
        </button>
      ))}

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      {(
        [
          ['left', AlignLeft, 'alignLeft'],
          ['center', AlignCenter, 'alignCenter'],
          ['right', AlignRight, 'alignRight'],
        ] as const
      ).map(([alignment, Icon, labelKey]) => (
        <button
          key={alignment}
          type="button"
          data-testid={`slide-style-align-${alignment}`}
          onMouseDown={keepSelection}
          onClick={() => setAlignment(alignment)}
          disabled={disabled}
          aria-pressed={override?.alignment === alignment}
          title={t(`stageEditor.style.${labelKey}`)}
          aria-label={t(`stageEditor.style.${labelKey}`)}
          className={buttonClass(override?.alignment === alignment)}
        >
          <Icon size={16} />
        </button>
      ))}

      <button
        type="button"
        data-testid="slide-style-reset"
        onMouseDown={keepSelection}
        onClick={() => onChange(null)}
        disabled={disabled || !isCustomized}
        title={t('stageEditor.style.restoreDefault')}
        aria-label={t('stageEditor.style.restoreDefault')}
        className={`${buttonClass(false)} ml-auto`}
      >
        <RotateCcw size={16} />
      </button>
    </div>
  )
}

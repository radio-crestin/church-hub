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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSlideSelection } from './getSlideSelection'
import { measureSlideFontSize } from './measureSlideFontSize'
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

/**
 * How long the size field waits after the last keystroke before applying. Long
 * enough to type "120" as one number rather than as 1, then 12, then 120; short
 * enough that nudging the spinner shows up straight away.
 */
const SIZE_COMMIT_DELAY_MS = 500

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

function clampSize(size: number): number {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(size)))
}

/** The styled run recorded for exactly this selection, if there is one. */
function rangeFor(
  override: SlideStyleOverride | null,
  selection: Selection | null,
): SlideStyleRange | undefined {
  if (!selection) return undefined
  return override?.ranges?.find(
    (range) => range.start === selection.start && range.end === selection.end,
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
 * Sizes are shown and typed as plain numbers even though they are stored as a
 * multiplier of the screen's size: that keeps a slide scaling with the screen
 * settings while giving the operator the absolute number they expect to type.
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
      setSelection(getSlideSelection())
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
  useEffect(() => {
    // A frame late, so the measurement sees the size the fit just settled on.
    const frame = requestAnimationFrame(() => {
      const measured = measureSlideFontSize(canvasWidth)
      if (measured !== null) setEffectiveSize(clampSize(measured))
    })
    return () => cancelAnimationFrame(frame)
  }, [canvasWidth, override, selection])

  const [sizeDraft, setSizeDraft] = useState('')
  const sizeDraftRef = useRef(sizeDraft)
  sizeDraftRef.current = sizeDraft
  useEffect(() => {
    setSizeDraft(effectiveSize > 0 ? String(effectiveSize) : '')
  }, [effectiveSize])

  const applySize = useCallback(
    (size: number) => {
      const target = clampSize(size)
      if (effectiveSize <= 0) return
      // Everything is stored as a multiplier, so the new size is expressed as
      // "how much bigger than what is on screen right now".
      const ratio = target / effectiveSize

      if (selection) {
        // Only the run's own share changes; the slide's scale stays put.
        onChange(
          updateSlideStyleRange(override, selection, {
            fontScale: (activeRange?.fontScale ?? 1) * ratio,
          }),
        )
        return
      }
      onChange({ ...override, fontScale: slideScale * ratio })
    },
    [override, onChange, selection, activeRange, slideScale, effectiveSize],
  )

  // Enter and blur both commit, and blur follows Enter — without remembering
  // what was already applied, leaving the field would apply the same number a
  // second time and halve (or double) the text again, because sizes are stored
  // as a ratio against what is currently rendered.
  const appliedRef = useRef<number | null>(null)
  useEffect(() => {
    appliedRef.current = null
  }, [selection])

  const commitDraft = useCallback(
    (returnFocus = false, draft = sizeDraftRef.current) => {
      const parsed = Number.parseFloat(draft.replace(',', '.'))
      if (!Number.isFinite(parsed)) {
        setSizeDraft(String(effectiveSize))
        return
      }
      if (appliedRef.current === parsed) return
      appliedRef.current = parsed
      applySize(parsed)

      // Hand the caret back to the slide so the styled words stay visibly
      // selected and can be resized again without re-selecting them.
      if (returnFocus) {
        document
          .querySelector<HTMLElement>('[data-testid="slide-canvas-editable"]')
          ?.focus()
      }
    },
    [effectiveSize, applySize],
  )

  // Typing or nudging the spinner applies on its own: waiting for Enter or for
  // focus to leave meant a size change sat there unapplied while the operator
  // kept editing the slide.
  useEffect(() => {
    if (sizeDraft === '' || sizeDraft === String(effectiveSize)) return
    const timer = setTimeout(
      () => commitDraft(false, sizeDraft),
      SIZE_COMMIT_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [sizeDraft, effectiveSize, commitDraft])

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
  // selection they are meant to style is gone by the time they run. The size
  // input is the exception — it has to take focus to be typed in, so it
  // remembers the selection it was opened with instead.
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
      <input
        type="number"
        inputMode="numeric"
        min={FONT_MIN}
        max={FONT_MAX}
        data-testid="slide-style-font-size"
        value={sizeDraft}
        disabled={disabled}
        onChange={(event) => setSizeDraft(event.target.value)}
        onBlur={() => commitDraft()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitDraft(true)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setSizeDraft(String(effectiveSize))
          }
        }}
        title={t('stageEditor.style.fontSize')}
        aria-label={t('stageEditor.style.fontSize')}
        className="w-16 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-sm tabular-nums text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
      />
      <button
        type="button"
        data-testid="slide-style-font-decrease"
        onMouseDown={keepSelection}
        onClick={() => {
          appliedRef.current = null
          applySize(effectiveSize * (1 - FONT_STEP_RATIO))
        }}
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
        onClick={() => {
          appliedRef.current = null
          applySize(effectiveSize * (1 + FONT_STEP_RATIO))
        }}
        disabled={disabled}
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

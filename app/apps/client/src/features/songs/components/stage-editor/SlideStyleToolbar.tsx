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
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { getSlideSelection } from './getSlideSelection'
import type { SlideStyleOverride } from '../../types'
import { updateSlideStyleRange } from '../../utils/updateSlideStyleRange'

/** How much one press of A+/A− changes the font size, and how far it can go. */
const FONT_STEP = 0.1
const FONT_MIN = 0.4
const FONT_MAX = 2.5

type Alignment = NonNullable<SlideStyleOverride['alignment']>

interface SlideStyleToolbarProps {
  /** Styling of the slide on the canvas, or null when it follows the screen. */
  override: SlideStyleOverride | null
  /** Called with the new styling, or null to fall back to the screen defaults. */
  onChange: (override: SlideStyleOverride | null) => void
  disabled?: boolean
}

function clampScale(scale: number): number {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(scale * 100) / 100))
}

/**
 * PowerPoint-style formatting bar above the stage canvas.
 *
 * Everything here is an override on top of the screen's own text settings, so
 * an untouched slide projects exactly as the screen dictates and "restore
 * default" is a matter of dropping the override. With text selected, the size
 * and bold/italic/underline buttons act on that selection; with only a caret
 * they act on the whole slide. Alignment is always a whole-slide property.
 */
export function SlideStyleToolbar({
  override,
  onChange,
  disabled = false,
}: SlideStyleToolbarProps) {
  const { t } = useTranslation('songs')

  const changeFontSize = useCallback(
    (direction: 1 | -1) => {
      const selection = getSlideSelection()
      if (selection) {
        const current =
          override?.ranges?.find(
            (range) =>
              range.start === selection.start && range.end === selection.end,
          )?.fontScale ?? 1
        onChange(
          updateSlideStyleRange(override, selection, {
            fontScale: clampScale(current + direction * FONT_STEP),
          }),
        )
        return
      }
      onChange({
        ...override,
        fontScale: clampScale(
          (override?.fontScale ?? 1) + direction * FONT_STEP,
        ),
      })
    },
    [override, onChange],
  )

  const toggleMark = useCallback(
    (mark: 'bold' | 'italic' | 'underline') => {
      const selection = getSlideSelection()
      if (selection) {
        const current =
          override?.ranges?.find(
            (range) =>
              range.start === selection.start && range.end === selection.end,
          )?.[mark] ?? false
        onChange(
          updateSlideStyleRange(override, selection, { [mark]: !current }),
        )
        return
      }
      onChange({ ...override, [mark]: !(override?.[mark] ?? false) })
    },
    [override, onChange],
  )

  const setAlignment = useCallback(
    (alignment: Alignment) => {
      onChange({ ...override, alignment })
    },
    [override, onChange],
  )

  const isCustomized = override !== null

  // Buttons must not steal focus from the contentEditable canvas, or the
  // selection they are meant to style is gone by the time they run.
  const keepSelection = (event: React.MouseEvent) => event.preventDefault()

  const buttonClass = (active: boolean) =>
    `flex items-center justify-center rounded-md border p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? 'border-indigo-400 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300'
        : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
    }`

  return (
    <div
      data-testid="slide-style-toolbar"
      className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        type="button"
        data-testid="slide-style-font-decrease"
        onMouseDown={keepSelection}
        onClick={() => changeFontSize(-1)}
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
        onClick={() => changeFontSize(1)}
        disabled={disabled}
        title={t('stageEditor.style.increaseFontSize')}
        aria-label={t('stageEditor.style.increaseFontSize')}
        className={buttonClass(false)}
      >
        <AArrowUp size={18} />
      </button>

      <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <button
        type="button"
        data-testid="slide-style-bold"
        onMouseDown={keepSelection}
        onClick={() => toggleMark('bold')}
        disabled={disabled}
        aria-pressed={override?.bold ?? false}
        title={t('stageEditor.style.bold')}
        aria-label={t('stageEditor.style.bold')}
        className={buttonClass(override?.bold ?? false)}
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        data-testid="slide-style-italic"
        onMouseDown={keepSelection}
        onClick={() => toggleMark('italic')}
        disabled={disabled}
        aria-pressed={override?.italic ?? false}
        title={t('stageEditor.style.italic')}
        aria-label={t('stageEditor.style.italic')}
        className={buttonClass(override?.italic ?? false)}
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        data-testid="slide-style-underline"
        onMouseDown={keepSelection}
        onClick={() => toggleMark('underline')}
        disabled={disabled}
        aria-pressed={override?.underline ?? false}
        title={t('stageEditor.style.underline')}
        aria-label={t('stageEditor.style.underline')}
        className={buttonClass(override?.underline ?? false)}
      >
        <Underline size={16} />
      </button>

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

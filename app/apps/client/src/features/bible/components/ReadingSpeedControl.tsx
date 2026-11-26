import { Gauge } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useAnchoredPopover } from '~/features/schedules/hooks/useAnchoredPopover'
import { HeaderIconButton } from '~/ui/button'
import { Slider } from '~/ui/slider'
import { useReadingSpeed } from '../hooks/useReadingSpeed'

const POPOVER_WIDTH = 256
const MIN_WPM = 40
const MAX_WPM = 400
/** Saved once the slider rests, so dragging doesn't save every step. */
const SAVE_DELAY_MS = 300

interface ReadingSpeedControlProps {
  testId: string
}

/**
 * The reading speed of a verse slideshow, from its header: a slider of words
 * per minute, the same setting as Settings, Bible. A playing slideshow picks
 * it up at once (the server rescales the verse on screen).
 */
export function ReadingSpeedControl({ testId }: ReadingSpeedControlProps) {
  const { t } = useTranslation('bible')
  const { wordsPerMinute, save } = useReadingSpeed()
  const { buttonRef, popoverRef, anchor, open, close } =
    useAnchoredPopover(POPOVER_WIDTH)
  const [value, setValue] = useState(wordsPerMinute)
  const sliderRef = useRef<HTMLInputElement>(null)

  useEffect(() => setValue(wordsPerMinute), [wordsPerMinute])

  // Keys then go to the slider, not to the page's shortcuts.
  useEffect(() => {
    if (anchor) sliderRef.current?.focus()
  }, [anchor])

  useEffect(() => {
    if (value === wordsPerMinute) return
    const timeout = setTimeout(() => save(value), SAVE_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [value, wordsPerMinute, save])

  const title = t('settings.readingSpeed.title')
  const speed = t('slideshow.wordsPerMinute', { count: value })

  return (
    <>
      <HeaderIconButton
        ref={buttonRef}
        label={title}
        tooltip={`${title} · ${speed}`}
        aria-expanded={anchor !== null}
        aria-haspopup="dialog"
        data-testid={testId}
        onClick={() => (anchor ? close() : open())}
      >
        <Gauge size={16} strokeWidth={1.5} />
      </HeaderIconButton>
      {anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={title}
            data-testid={`${testId}-popover`}
            className="fixed z-50 rounded-[10px] border border-line bg-panel p-3 shadow-popover"
            style={{ left: anchor.x, top: anchor.y, width: POPOVER_WIDTH }}
            // Arrows move the slider and Escape closes it, rather than
            // stepping or hiding what is on screen.
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key !== 'Escape') return
              close()
              buttonRef.current?.focus()
            }}
          >
            <p className="text-sm font-medium text-fg">{title}</p>
            <p
              data-testid={`${testId}-value`}
              className="text-sm tabular-nums text-fg-body"
            >
              {speed}
            </p>
            <Slider
              ref={sliderRef}
              value={[Math.min(MAX_WPM, Math.max(MIN_WPM, value))]}
              onValueChange={([next]) => next && setValue(next)}
              min={MIN_WPM}
              max={MAX_WPM}
              step={10}
              showValue={false}
              testId={`${testId}-slider`}
              ariaLabel={title}
              ariaValueText={speed}
              className="mt-3"
            />
            <div className="mt-1 flex justify-between text-xs text-fg-hint">
              <span>{t('slideshow.slower')}</span>
              <span>{t('slideshow.faster')}</span>
            </div>
            <p className="mt-2 text-xs text-fg-hint">
              {t('slideshow.speedHint')}
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}

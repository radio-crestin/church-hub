import { Timer } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useAnchoredPopover } from '../hooks/useAnchoredPopover'

interface ScheduleItemAdvanceProps {
  /** The item's own time per slide; null = the presentation's. */
  advanceSeconds: number | null
  /** What each of its slides gets from the presentation's timing. */
  defaultSeconds: number[]
  onChange: (advanceSeconds: number | null) => void
}

const POPOVER_WIDTH = 240

/**
 * How long each slide of an item stays up while the presentation runs by
 * itself, beside the item like PowerPoint's "After" under each slide. Its own
 * time shows in colour; the presentation's in grey, as a range when its slides
 * differ. Clicking it sets the item's own time or gives it back the default.
 */
export function ScheduleItemAdvance({
  advanceSeconds,
  defaultSeconds,
  onChange,
}: ScheduleItemAdvanceProps) {
  const { t } = useTranslation('schedules')
  const {
    buttonRef,
    popoverRef,
    anchor,
    open: openPopover,
    close,
  } = useAnchoredPopover(POPOVER_WIDTH)
  const [value, setValue] = useState(0)

  const min = Math.min(...defaultSeconds)
  const max = Math.max(...defaultSeconds)
  const custom = advanceSeconds != null
  const label = custom
    ? `${advanceSeconds} s`
    : min === max
      ? `${min} s`
      : `${min}–${max} s`

  const open = () => {
    setValue(advanceSeconds ?? max)
    openPopover()
  }

  const apply = (seconds: number | null) => {
    if (seconds === null || (Number.isFinite(seconds) && seconds >= 1)) {
      onChange(seconds === null ? null : Math.round(seconds))
    }
    close()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (anchor) close()
          else open()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title={t('automation.advance.title')}
        data-testid="schedule-item-advance"
        data-custom={custom ? 'true' : undefined}
        className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs tabular-nums ${
          custom
            ? 'bg-selected text-fg hover:bg-hover'
            : 'text-fg-hint hover:bg-hover'
        }`}
      >
        <Timer size={12} strokeWidth={2} />
        {label}
      </button>
      {anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t('automation.advance.title')}
            data-testid="schedule-item-advance-popover"
            className="fixed z-50 rounded-[10px] border border-line bg-panel p-3 shadow-popover"
            style={{ left: anchor.x, top: anchor.y, width: POPOVER_WIDTH }}
            // React events bubble out of a portal to the item row, which
            // would open or present the item.
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                apply(value)
              }}
            >
              <label className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
                {t('automation.advance.title')}
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    value={Number.isFinite(value) ? value : ''}
                    onChange={(e) => setValue(e.target.valueAsNumber)}
                    autoFocus
                    data-testid="schedule-item-advance-input"
                    className="w-16 rounded-[10px] border-0 bg-field px-2 py-1 text-right tabular-nums text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                  />
                  s
                </span>
              </label>
              <p className="mt-1 text-xs text-fg-hint">
                {t('automation.advance.description')}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                {custom && (
                  <button
                    type="button"
                    onClick={() => apply(null)}
                    data-testid="schedule-item-advance-reset"
                    className="rounded-lg px-2 py-1 text-sm text-fg-body hover:bg-hover"
                  >
                    {t('automation.advance.reset')}
                  </button>
                )}
                <button
                  type="submit"
                  data-testid="schedule-item-advance-save"
                  className="rounded-lg bg-primary px-3 py-1 text-sm text-white hover:bg-indigo-700"
                >
                  {t('automation.advance.save')}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  )
}

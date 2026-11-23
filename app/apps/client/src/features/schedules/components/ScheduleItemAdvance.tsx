import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [value, setValue] = useState(0)

  const min = Math.min(...defaultSeconds)
  const max = Math.max(...defaultSeconds)
  const custom = advanceSeconds != null
  const label = custom
    ? `${advanceSeconds} s`
    : min === max
      ? `${min} s`
      : `${min}–${max} s`

  useEffect(() => {
    if (!anchor) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !popoverRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      )
        setAnchor(null)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAnchor(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [anchor])

  const open = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setValue(advanceSeconds ?? max)
    setAnchor({
      x: Math.max(
        8,
        Math.min(
          rect.right - POPOVER_WIDTH,
          window.innerWidth - POPOVER_WIDTH - 8,
        ),
      ),
      y: rect.bottom + 4,
    })
  }

  const apply = (seconds: number | null) => {
    if (seconds === null || (Number.isFinite(seconds) && seconds >= 1)) {
      onChange(seconds === null ? null : Math.round(seconds))
    }
    setAnchor(null)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (anchor) setAnchor(null)
          else open()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title={t('automation.advance.title')}
        data-testid="schedule-item-advance"
        data-custom={custom ? 'true' : undefined}
        className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs tabular-nums ${
          custom
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300'
            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
      >
        <Timer size={12} />
        {label}
      </button>
      {anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t('automation.advance.title')}
            data-testid="schedule-item-advance-popover"
            className="fixed z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
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
              <label className="flex items-center justify-between gap-2 text-sm font-medium text-gray-900 dark:text-white">
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
                    className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  s
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('automation.advance.description')}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                {custom && (
                  <button
                    type="button"
                    onClick={() => apply(null)}
                    data-testid="schedule-item-advance-reset"
                    className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {t('automation.advance.reset')}
                  </button>
                )}
                <button
                  type="submit"
                  data-testid="schedule-item-advance-save"
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700"
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

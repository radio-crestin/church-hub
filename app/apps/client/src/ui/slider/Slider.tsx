import { forwardRef, useRef } from 'react'

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  /** The value the user settles on: at the end of a drag, or each key press */
  onValueCommit?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  showValue?: boolean
  formatValue?: (value: number) => string
  /** What the slider sets, for screen readers */
  label?: string
  /** Test id of the range input */
  testId?: string
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value = [0],
      onValueChange,
      onValueCommit,
      min = 0,
      max = 100,
      step = 1,
      disabled,
      className = '',
      showValue = true,
      formatValue,
      label,
      testId,
    },
    ref,
  ) => {
    const drag = useRef<{ value: number | null } | null>(null)

    const startDrag = () => {
      const current = { value: null as number | null }
      drag.current = current
      const controller = new AbortController()
      const endDrag = () => {
        controller.abort()
        drag.current = null
        if (current.value !== null) onValueCommit?.([current.value])
      }
      window.addEventListener('pointerup', endDrag, controller)
      window.addEventListener('pointercancel', endDrag, controller)
    }

    const change = (next: number) => {
      onValueChange?.([next])
      if (drag.current) drag.current.value = next
      else onValueCommit?.([next])
    }

    return (
      <div
        className={`flex items-center ${showValue ? 'gap-3' : ''} ${className}`}
      >
        <input
          ref={ref}
          type="range"
          data-testid={testId}
          aria-label={label}
          value={value[0]}
          onChange={(e) => {
            // The user's moves are input events; the change event that ends a
            // drag can carry the value shown after the commit, not the user's.
            if (e.nativeEvent.type === 'input')
              change(parseFloat(e.target.value))
          }}
          onPointerDown={startDrag}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full h-1.5 bg-field rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {showValue && (
          <span className="text-xs tabular-nums text-fg-hint w-12 text-right">
            {formatValue ? formatValue(value[0]) : Math.round(value[0])}
          </span>
        )}
      </div>
    )
  },
)

Slider.displayName = 'Slider'

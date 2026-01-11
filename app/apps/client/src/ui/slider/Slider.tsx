import { forwardRef } from 'react'

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  showValue?: boolean
  formatValue?: (value: number) => string
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value = [0],
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled,
      className = '',
      showValue = true,
      formatValue,
    },
    ref,
  ) => {
    return (
      <div
        className={`flex items-center ${showValue ? 'gap-3' : ''} ${className}`}
      >
        <input
          ref={ref}
          type="range"
          value={value[0]}
          onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {showValue && (
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
            {formatValue ? formatValue(value[0]) : Math.round(value[0])}
          </span>
        )}
      </div>
    )
  },
)

Slider.displayName = 'Slider'

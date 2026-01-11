import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
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
      onValueCommit,
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
    const [isInteracting, setIsInteracting] = useState(false)
    const [localValue, setLocalValue] = useState(value[0])
    const interactingRef = useRef(false)

    // Sync local value with prop when not interacting
    useEffect(() => {
      if (!interactingRef.current) {
        setLocalValue(value[0])
      }
    }, [value])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value)
        setLocalValue(newValue)
        onValueChange?.([newValue])
      },
      [onValueChange],
    )

    const handleInteractionStart = useCallback(() => {
      interactingRef.current = true
      setIsInteracting(true)
    }, [])

    const handleInteractionEnd = useCallback(() => {
      interactingRef.current = false
      setIsInteracting(false)
      onValueCommit?.([localValue])
    }, [onValueCommit, localValue])

    // Use local value while interacting, prop value otherwise
    const displayValue = isInteracting ? localValue : value[0]

    return (
      <div
        className={`flex items-center ${showValue ? 'gap-3' : ''} ${className}`}
      >
        <input
          ref={ref}
          type="range"
          value={displayValue}
          onChange={handleChange}
          onMouseDown={handleInteractionStart}
          onMouseUp={handleInteractionEnd}
          onTouchStart={handleInteractionStart}
          onTouchEnd={handleInteractionEnd}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {showValue && (
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
            {formatValue ? formatValue(displayValue) : Math.round(displayValue)}
          </span>
        )}
      </div>
    )
  },
)

Slider.displayName = 'Slider'

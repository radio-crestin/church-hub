import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ICON_COLOR_CLASSES, ICON_COLORS } from '../constants'
import type { IconColor } from '../types'

interface IconColorPickerProps {
  /** Selected predefined color */
  value?: IconColor
  /** Custom hex color (takes precedence over value) */
  customColor?: string
  /** Callback when predefined color is selected */
  onChange: (color: IconColor | undefined) => void
  /** Callback when custom color is selected */
  onCustomColorChange?: (color: string | undefined) => void
  /** Whether to show the custom color picker option */
  showCustomOption?: boolean
}

/**
 * Grid-based color picker for sidebar icon colors with optional custom color support
 */
export function IconColorPicker({
  value,
  customColor,
  onChange,
  onCustomColorChange,
  showCustomOption = false,
}: IconColorPickerProps) {
  const { t } = useTranslation('settings')
  const colorInputRef = useRef<HTMLInputElement>(null)

  const hasCustomColor = !!customColor
  const isDefaultSelected = !value && !hasCustomColor

  const handleCustomColorClick = () => {
    colorInputRef.current?.click()
  }

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value
    onChange(undefined) // Clear predefined color
    onCustomColorChange?.(hex)
  }

  const handlePredefinedColorSelect = (color: IconColor) => {
    onChange(color)
    onCustomColorChange?.(undefined) // Clear custom color
  }

  const handleClearSelection = () => {
    onChange(undefined)
    onCustomColorChange?.(undefined)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Default/Clear button */}
      {showCustomOption && (
        <button
          type="button"
          onClick={handleClearSelection}
          className={`
            w-8 h-8 rounded-full transition-all flex items-center justify-center
            bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600
            ${isDefaultSelected ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-gray-900 dark:ring-white' : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}
          `}
          title={t('sections.sidebarItem.iconColor.default')}
        >
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            A
          </span>
        </button>
      )}

      {/* Predefined colors */}
      {ICON_COLORS.map((color) => {
        const isSelected = value === color && !hasCustomColor
        const colorClasses = ICON_COLOR_CLASSES[color]

        return (
          <button
            key={color}
            type="button"
            onClick={() => handlePredefinedColorSelect(color)}
            className={`
              w-8 h-8 rounded-full transition-all flex items-center justify-center
              ${colorClasses.bg}
              ${isSelected ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' : ''}
              ${isSelected ? 'ring-gray-900 dark:ring-white' : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}
            `}
            title={color}
          >
            <div
              className={`w-4 h-4 rounded-full ${colorClasses.text.replace('text-', 'bg-')}`}
            />
          </button>
        )
      })}

      {/* Custom color picker */}
      {showCustomOption && (
        <>
          <button
            type="button"
            onClick={handleCustomColorClick}
            className={`
              w-8 h-8 rounded-full transition-all flex items-center justify-center
              border-2 border-dashed border-gray-300 dark:border-gray-600
              ${hasCustomColor ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-gray-900 dark:ring-white' : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}
            `}
            style={
              hasCustomColor ? { backgroundColor: customColor } : undefined
            }
            title={t('sections.sidebarItem.iconColor.custom')}
          >
            {!hasCustomColor && (
              <span className="text-lg text-gray-400 dark:text-gray-500">
                +
              </span>
            )}
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={customColor ?? '#6366f1'}
            onChange={handleColorInputChange}
            className="sr-only"
          />
        </>
      )}
    </div>
  )
}

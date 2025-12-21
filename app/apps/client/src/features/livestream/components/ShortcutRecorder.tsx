import { X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatShortcutForDisplay,
  isModifierKey,
} from '../utils/shortcutValidation'

interface ShortcutRecorderProps {
  value: string
  onChange: (shortcut: string) => void
  onRemove: () => void
  error?: string
}

export function ShortcutRecorder({
  value,
  onChange,
  onRemove,
  error,
}: ShortcutRecorderProps) {
  const { t } = useTranslation('livestream')
  const [isRecording, setIsRecording] = useState(false)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!isRecording) return

      const parts: string[] = []

      if (e.metaKey || e.ctrlKey) {
        parts.push('CommandOrControl')
      }
      if (e.altKey) {
        parts.push('Alt')
      }
      if (e.shiftKey) {
        parts.push('Shift')
      }

      if (!isModifierKey(e.key)) {
        const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
        parts.push(key)
      }

      if (parts.length > 0 && !isModifierKey(e.key)) {
        onChange(parts.join('+'))
        setIsRecording(false)
      }
    },
    [isRecording, onChange],
  )

  const handleFocus = useCallback(() => {
    setIsRecording(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsRecording(false)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          readOnly
          value={value ? formatShortcutForDisplay(value) : ''}
          placeholder={
            isRecording
              ? t('scenes.recordShortcut')
              : t('scenes.clickToRecord', { defaultValue: 'Click to record' })
          }
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`
            w-full px-3 py-2 text-sm
            border rounded-lg
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2
            cursor-pointer
            ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : isRecording
                  ? 'border-indigo-500 focus:ring-indigo-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'
            }
          `}
        />
        {isRecording && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-500 animate-pulse">
            {t('scenes.recording', { defaultValue: 'Recording...' })}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title={t('scenes.removeShortcut')}
      >
        <X size={18} />
      </button>
    </div>
  )
}

import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BackgroundType, Display, DisplayTheme } from '../types'
import { getDefaultTheme } from '../types'

interface DisplayThemeEditorProps {
  display: Display
  isOpen: boolean
  onClose: () => void
  onSave: (theme: DisplayTheme) => void
  isSaving?: boolean
}

const FONT_OPTIONS = [
  { value: 'system-ui', label: 'System' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' },
]

export function DisplayThemeEditor({
  display,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: DisplayThemeEditorProps) {
  const { t } = useTranslation('presentation')
  const defaultTheme = getDefaultTheme()

  const [theme, setTheme] = useState<DisplayTheme>({
    ...defaultTheme,
    ...display.theme,
  })

  useEffect(() => {
    if (isOpen) {
      setTheme({ ...defaultTheme, ...display.theme })
    }
  }, [isOpen, display.theme, defaultTheme])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(theme)
  }

  const updateTheme = (updates: Partial<DisplayTheme>) => {
    setTheme((prev) => ({ ...prev, ...updates }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('theme.title')} - {display.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Background Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('theme.backgroundType')}
            </label>
            <div className="flex gap-2">
              {(['transparent', 'color', 'image'] as BackgroundType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateTheme({ backgroundType: type })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      theme.backgroundType === type
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t(`theme.backgrounds.${type}`)}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Background Color */}
          {theme.backgroundType === 'color' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('theme.backgroundColor')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={theme.backgroundColor || '#000000'}
                  onChange={(e) =>
                    updateTheme({ backgroundColor: e.target.value })
                  }
                  className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.backgroundColor || '#000000'}
                  onChange={(e) =>
                    updateTheme({ backgroundColor: e.target.value })
                  }
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}

          {/* Background Image URL */}
          {theme.backgroundType === 'image' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('theme.backgroundImage')}
              </label>
              <input
                type="url"
                value={theme.backgroundImage || ''}
                onChange={(e) =>
                  updateTheme({ backgroundImage: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
              />
            </div>
          )}

          {/* Text Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('theme.textColor')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={theme.textColor || '#ffffff'}
                onChange={(e) => updateTheme({ textColor: e.target.value })}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={theme.textColor || '#ffffff'}
                onChange={(e) => updateTheme({ textColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('theme.fontFamily')}
            </label>
            <select
              value={theme.fontFamily || 'system-ui'}
              onChange={(e) => updateTheme({ fontFamily: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Padding */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('theme.padding')} ({theme.padding || 40}px)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={theme.padding || 40}
              onChange={(e) =>
                updateTheme({ padding: Number.parseInt(e.target.value, 10) })
              }
              className="w-full"
            />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('theme.preview')}
            </label>
            <div
              className="w-full h-32 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden"
              style={{
                backgroundColor:
                  theme.backgroundType === 'color'
                    ? theme.backgroundColor
                    : theme.backgroundType === 'transparent'
                      ? 'transparent'
                      : '#333',
                backgroundImage:
                  theme.backgroundType === 'image' && theme.backgroundImage
                    ? `url(${theme.backgroundImage})`
                    : theme.backgroundType === 'transparent'
                      ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 20px 20px'
                      : undefined,
                backgroundSize:
                  theme.backgroundType === 'image' ? 'cover' : undefined,
                padding: theme.padding,
              }}
            >
              <span
                style={{
                  color: theme.textColor,
                  fontFamily: theme.fontFamily,
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                }}
              >
                {t('theme.sampleText')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {t('actions.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

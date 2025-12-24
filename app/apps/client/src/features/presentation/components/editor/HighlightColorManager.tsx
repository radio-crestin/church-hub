import {
  Check,
  GripVertical,
  Loader2,
  Palette,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import {
  useDeleteHighlightColor,
  useHighlightColors,
  useUpsertHighlightColor,
} from '../../hooks/useHighlightColors'

interface HighlightColorManagerProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Calculates whether text should be light or dark based on background color.
 * Uses the relative luminance formula.
 */
function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/**
 * Preset colors with good contrast combinations
 */
const PRESET_COLORS = [
  { color: '#FFEB3B', textColor: '#000000', name: 'Yellow' },
  { color: '#4CAF50', textColor: '#FFFFFF', name: 'Green' },
  { color: '#FF6B6B', textColor: '#FFFFFF', name: 'Red' },
]

export function HighlightColorManager({
  isOpen,
  onClose,
}: HighlightColorManagerProps) {
  const { t } = useTranslation('presentation')
  const { data: colors = [], isLoading } = useHighlightColors()
  const upsertMutation = useUpsertHighlightColor()
  const deleteMutation = useDeleteHighlightColor()

  const [newColorName, setNewColorName] = useState('')
  const [newColorValue, setNewColorValue] = useState('#FFEB3B')
  const [newTextColor, setNewTextColor] = useState('#000000')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState('')
  const [editingTextColor, setEditingTextColor] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  // Auto-calculate text color when background changes
  useEffect(() => {
    setNewTextColor(getContrastTextColor(newColorValue))
  }, [newColorValue])

  useEffect(() => {
    if (editingColor) {
      setEditingTextColor(getContrastTextColor(editingColor))
    }
  }, [editingColor])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAddColor = async () => {
    if (!newColorName.trim() || !newColorValue) return

    await upsertMutation.mutateAsync({
      name: newColorName.trim(),
      color: newColorValue,
      textColor: newTextColor,
    })

    setNewColorName('')
    setNewColorValue('#FFEB3B')
    setNewTextColor('#000000')
    setShowPresets(false)
  }

  const handleAddPreset = async (preset: (typeof PRESET_COLORS)[0]) => {
    await upsertMutation.mutateAsync({
      name: preset.name,
      color: preset.color,
      textColor: preset.textColor,
    })
    setShowPresets(false)
  }

  const handleUpdateColor = async () => {
    if (!editingId || !editingName.trim() || !editingColor) return

    await upsertMutation.mutateAsync({
      id: editingId,
      name: editingName.trim(),
      color: editingColor,
      textColor: editingTextColor,
    })

    setEditingId(null)
    setEditingName('')
    setEditingColor('')
    setEditingTextColor('')
  }

  const handleDeleteColor = async (id: number) => {
    await deleteMutation.mutateAsync(id)
  }

  const startEditing = (
    id: number,
    name: string,
    color: string,
    textColor: string,
  ) => {
    setEditingId(id)
    setEditingName(name)
    setEditingColor(color)
    setEditingTextColor(textColor || getContrastTextColor(color))
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
    setEditingColor('')
    setEditingTextColor('')
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop - clicks close the modal */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
              <Palette className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('highlight.colors', 'Highlight Colors')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(
                  'highlight.manageColorsDesc',
                  'Customize your highlight palette',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Existing colors */}
              {colors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('highlight.yourColors', 'Your Colors')}
                  </h3>
                  <div className="space-y-2">
                    {colors.map((color) => (
                      <div
                        key={color.id}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        {editingId === color.id ? (
                          <div className="flex-1 flex items-center gap-3">
                            <div className="relative">
                              <input
                                type="color"
                                value={editingColor}
                                onChange={(e) =>
                                  setEditingColor(e.target.value)
                                }
                                className="w-12 h-12 rounded-xl cursor-pointer border-2 border-gray-200 dark:border-gray-700"
                              />
                              <span
                                className="absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none"
                                style={{ color: editingTextColor }}
                              >
                                Aa
                              </span>
                            </div>
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder={t(
                                'highlight.colorName',
                                'Color name',
                              )}
                            />
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleUpdateColor}
                                disabled={upsertMutation.isPending}
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg disabled:opacity-50 transition-colors"
                              >
                                <Check size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <GripVertical
                              size={16}
                              className="text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity"
                            />
                            <div
                              className="w-12 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: color.color }}
                            >
                              <span
                                className="text-xs font-bold"
                                style={{ color: color.textColor || '#000000' }}
                              >
                                Aa
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                                {color.name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {color.color}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() =>
                                  startEditing(
                                    color.id,
                                    color.name,
                                    color.color,
                                    color.textColor,
                                  )
                                }
                                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                {t('highlight.editColor', 'Edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteColor(color.id)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {colors.length === 0 && !showPresets && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <Palette className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {t('highlight.noColors', 'No colors defined yet')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPresets(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} />
                    {t('highlight.addFromPresets', 'Add from presets')}
                  </button>
                </div>
              )}

              {/* Preset colors */}
              {showPresets && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('highlight.presetColors', 'Preset Colors')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowPresets(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => handleAddPreset(preset)}
                        disabled={colors.some((c) => c.color === preset.color)}
                        className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: preset.color }}
                        >
                          <span
                            className="text-xs font-bold"
                            style={{ color: preset.textColor }}
                          >
                            Aa
                          </span>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new color */}
              {!showPresets && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('highlight.addColor', 'Add Color')}
                    </h3>
                    {colors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPresets(true)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t('highlight.viewPresets', 'View presets')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={newColorValue}
                        onChange={(e) => setNewColorValue(e.target.value)}
                        className="w-14 h-14 rounded-xl cursor-pointer border-2 border-gray-200 dark:border-gray-700"
                      />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-sm font-bold pointer-events-none"
                        style={{ color: newTextColor }}
                      >
                        Aa
                      </span>
                    </div>
                    <input
                      type="text"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      placeholder={t(
                        'highlight.colorNamePlaceholder',
                        'Color name (e.g., Yellow)',
                      )}
                      className="flex-1 px-4 py-3 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddColor()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddColor}
                      disabled={
                        upsertMutation.isPending || !newColorName.trim()
                      }
                      className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {upsertMutation.isPending ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Plus size={20} />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

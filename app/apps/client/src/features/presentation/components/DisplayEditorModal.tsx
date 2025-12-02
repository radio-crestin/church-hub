import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Display, DisplayOpenMode, UpsertDisplayInput } from '../types'

interface DisplayEditorModalProps {
  display: Display | null
  isOpen: boolean
  onClose: () => void
  onSave: (input: UpsertDisplayInput) => void
  isSaving?: boolean
}

export function DisplayEditorModal({
  display,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: DisplayEditorModalProps) {
  const { t } = useTranslation('presentation')
  const modalRef = useRef<HTMLDivElement>(null)
  const isNew = !display

  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [openMode, setOpenMode] = useState<DisplayOpenMode>('browser')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (display) {
        setName(display.name)
        setIsActive(display.isActive)
        setOpenMode(display.openMode || 'browser')
        setIsFullscreen(display.isFullscreen || false)
      } else {
        setName('')
        setIsActive(true)
        setOpenMode('browser')
        setIsFullscreen(false)
      }
    }
  }, [isOpen, display])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  if (!isOpen) return null

  const handleSave = () => {
    if (!name.trim()) return

    const input: UpsertDisplayInput = {
      name: name.trim(),
      isActive,
      openMode,
      isFullscreen: openMode === 'native' ? isFullscreen : false,
    }

    if (display?.id) {
      input.id = display.id
      input.theme = display.theme
    }

    onSave(input)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNew ? t('displays.add') : t('displays.edit')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label
              htmlFor="display-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('displays.name')}
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('displays.namePlaceholder')}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="display-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-indigo-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
            />
            <label
              htmlFor="display-active"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              {t('displays.activeLabel')}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('displays.openMode')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenMode('browser')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  openMode === 'browser'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t('displays.openModes.browser')}
              </button>
              <button
                type="button"
                onClick={() => setOpenMode('native')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  openMode === 'native'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t('displays.openModes.native')}
              </button>
            </div>
          </div>

          {openMode === 'native' && (
            <div className="flex items-center gap-3">
              <input
                id="display-fullscreen"
                type="checkbox"
                checked={isFullscreen}
                onChange={(e) => setIsFullscreen(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
              />
              <label
                htmlFor="display-fullscreen"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {t('displays.fullscreenLabel')}
              </label>
            </div>
          )}
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
            disabled={isSaving || !name.trim()}
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

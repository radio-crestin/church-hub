import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconPicker } from './IconPicker'
import type { CustomPageInput, CustomPageMenuItem } from '../types'

interface CustomPageFormModalProps {
  isOpen: boolean
  editingPage?: CustomPageMenuItem | null
  onSubmit: (input: CustomPageInput) => void
  onClose: () => void
}

/**
 * Validates a URL string
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Modal for creating or editing a custom page
 */
export function CustomPageFormModal({
  isOpen,
  editingPage,
  onSubmit,
  onClose,
}: CustomPageFormModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [iconName, setIconName] = useState('Globe')
  const [useIframeEmbedding, setUseIframeEmbedding] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})

  const isEditing = !!editingPage

  // Reset form when modal opens/closes or editing page changes
  useEffect(() => {
    if (isOpen) {
      if (editingPage) {
        setTitle(editingPage.title)
        setUrl(editingPage.url)
        setIconName(editingPage.iconName)
        setUseIframeEmbedding(editingPage.useIframeEmbedding ?? false)
      } else {
        setTitle('')
        setUrl('')
        setIconName('Globe')
        setUseIframeEmbedding(false)
      }
      setErrors({})
    }
  }, [isOpen, editingPage])

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Focus title input after opening
      setTimeout(() => titleInputRef.current?.focus(), 50)
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { title?: string; url?: string } = {}

    if (!title.trim()) {
      newErrors.title = t('sections.sidebar.validation.titleRequired')
    }

    if (!url.trim()) {
      newErrors.url = t('sections.sidebar.validation.urlRequired')
    } else if (!isValidUrl(url)) {
      newErrors.url = t('sections.sidebar.validation.urlInvalid')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    onSubmit({
      id: editingPage?.id,
      title: title.trim(),
      url: url.trim(),
      iconName,
      useIframeEmbedding,
    })
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-lg w-full"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing
            ? t('sections.sidebar.modals.edit.title')
            : t('sections.sidebar.modals.create.title')}
        </h2>

        <div className="space-y-4">
          {/* Title Input */}
          <div className="space-y-1">
            <label
              htmlFor="custom-page-title"
              className="text-sm font-medium text-gray-900 dark:text-white"
            >
              {t('sections.sidebar.fields.title')}
            </label>
            <input
              ref={titleInputRef}
              id="custom-page-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('sections.sidebar.fields.titlePlaceholder')}
              className={`
                block w-full px-3 py-2.5 bg-white dark:bg-gray-700
                border text-gray-900 dark:text-white text-sm rounded-lg
                focus:ring-indigo-500 focus:border-indigo-500
                placeholder:text-gray-500 dark:placeholder:text-gray-400
                ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              `}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* URL Input */}
          <div className="space-y-1">
            <label
              htmlFor="custom-page-url"
              className="text-sm font-medium text-gray-900 dark:text-white"
            >
              {t('sections.sidebar.fields.url')}
            </label>
            <input
              id="custom-page-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('sections.sidebar.fields.urlPlaceholder')}
              className={`
                block w-full px-3 py-2.5 bg-white dark:bg-gray-700
                border text-gray-900 dark:text-white text-sm rounded-lg
                focus:ring-indigo-500 focus:border-indigo-500
                placeholder:text-gray-500 dark:placeholder:text-gray-400
                ${errors.url ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              `}
            />
            {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('sections.sidebar.fields.urlHint')}
            </p>
          </div>

          {/* Icon Picker */}
          <IconPicker value={iconName} onChange={setIconName} />

          {/* Use Iframe Embedding Checkbox */}
          <div className="flex items-start gap-3 pt-2">
            <input
              id="use-iframe-embedding"
              type="checkbox"
              checked={useIframeEmbedding}
              onChange={(e) => setUseIframeEmbedding(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <label
                htmlFor="use-iframe-embedding"
                className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
              >
                {t('sections.sidebar.fields.useIframeEmbedding')}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.sidebar.fields.useIframeEmbeddingHint')}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            {isEditing
              ? t('sections.sidebar.modals.edit.submit')
              : t('sections.sidebar.modals.create.submit')}
          </button>
        </div>
      </form>
    </dialog>
  )
}

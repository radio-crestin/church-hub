import { Globe, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconPicker } from './IconPicker'
import type {
  CustomPageInput,
  CustomPageMenuItem,
  IconSourceType,
} from '../types'
import { fetchFavicon } from '../utils/fetchFavicon'

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
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [iconName, setIconName] = useState('Globe')
  const [useIframeEmbedding, setUseIframeEmbedding] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})
  const [customIconUrl, setCustomIconUrl] = useState<string | undefined>()
  const [iconSource, setIconSource] = useState<IconSourceType>('favicon')
  const [isFetchingFavicon, setIsFetchingFavicon] = useState(false)
  const [faviconColor, setFaviconColor] = useState<string | undefined>()
  const lastFetchedUrlRef = useRef<string>('')

  const isEditing = !!editingPage

  // Reset form when modal opens/closes or editing page changes
  useEffect(() => {
    if (isOpen) {
      if (editingPage) {
        setTitle(editingPage.title)
        setUrl(editingPage.url)
        setIconName(editingPage.iconName)
        setUseIframeEmbedding(editingPage.useIframeEmbedding ?? false)
        setCustomIconUrl(editingPage.customIconUrl)
        setIconSource(editingPage.iconSource ?? 'favicon')
        setFaviconColor(editingPage.faviconColor)
        lastFetchedUrlRef.current = editingPage.url
      } else {
        setTitle('')
        setUrl('')
        setIconName('Globe')
        setUseIframeEmbedding(false)
        setCustomIconUrl(undefined)
        setIconSource('favicon')
        setFaviconColor(undefined)
        lastFetchedUrlRef.current = ''
      }
      setErrors({})
      setIsFetchingFavicon(false)
    }
  }, [isOpen, editingPage])

  // Fetch favicon function
  const handleFetchFavicon = useCallback(async (urlToFetch: string) => {
    if (!urlToFetch.trim() || !isValidUrl(urlToFetch)) return

    setIsFetchingFavicon(true)
    try {
      const result = await fetchFavicon(urlToFetch.trim())
      if (result) {
        setCustomIconUrl(result.dataUrl)
        setFaviconColor(result.dominantColor)
        setIconSource('favicon')
        lastFetchedUrlRef.current = urlToFetch.trim()
      }
    } finally {
      setIsFetchingFavicon(false)
    }
  }, [])

  // Auto-fetch favicon when URL changes (with debounce)
  useEffect(() => {
    if (!isOpen || !url.trim() || !isValidUrl(url)) return
    if (lastFetchedUrlRef.current === url.trim()) return

    const timer = setTimeout(() => {
      void handleFetchFavicon(url)
    }, 500)

    return () => clearTimeout(timer)
  }, [url, isOpen, handleFetchFavicon])

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

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
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
      customIconUrl: iconSource === 'favicon' ? customIconUrl : undefined,
      iconSource,
      faviconColor: iconSource === 'favicon' ? faviconColor : undefined,
    })
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel max-w-lg w-full"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="text-base font-semibold text-fg mb-4">
          {isEditing
            ? t('sections.sidebar.modals.edit.title')
            : t('sections.sidebar.modals.create.title')}
        </h2>

        <div className="space-y-4">
          {/* Title Input */}
          <div className="space-y-1">
            <label
              htmlFor="custom-page-title"
              className="text-[13px] font-medium text-fg"
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
                block w-full h-9 px-3 bg-field
                border text-fg text-[13px] rounded-[10px]
                focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
                placeholder:text-fg-hint
                ${errors.title ? 'border-red-500' : 'border-transparent'}
              `}
            />
            {errors.title && (
              <p className="text-[13px] text-red-500">{errors.title}</p>
            )}
          </div>

          {/* URL Input */}
          <div className="space-y-1">
            <label
              htmlFor="custom-page-url"
              className="text-[13px] font-medium text-fg"
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
                block w-full h-9 px-3 bg-field
                border text-fg text-[13px] rounded-[10px]
                focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
                placeholder:text-fg-hint
                ${errors.url ? 'border-red-500' : 'border-transparent'}
              `}
            />
            {errors.url && (
              <p className="text-[13px] text-red-500">{errors.url}</p>
            )}
            <p className="text-xs text-fg-hint">
              {t('sections.sidebar.fields.urlHint')}
            </p>
          </div>

          {/* Icon Source Selection */}
          <div className="space-y-3">
            <div>
              <h4 className="text-[13px] font-medium text-fg">
                {t('sections.sidebar.fields.icon')}
              </h4>
              <p className="text-xs text-fg-hint mt-0.5">
                {t('sections.sidebar.fields.iconSourceDescription')}
              </p>
            </div>

            {/* Icon Source Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIconSource('favicon')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[13px] rounded-lg border transition-colors ${
                  iconSource === 'favicon'
                    ? 'bg-selected border-transparent text-fg'
                    : 'bg-field border-transparent text-fg-body hover:bg-hover'
                }`}
              >
                <Globe size={16} strokeWidth={1.5} />
                {t('sections.sidebar.fields.useFavicon')}
              </button>
              <button
                type="button"
                onClick={() => setIconSource('icon')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[13px] rounded-lg border transition-colors ${
                  iconSource === 'icon'
                    ? 'bg-selected border-transparent text-fg'
                    : 'bg-field border-transparent text-fg-body hover:bg-hover'
                }`}
              >
                {t('sections.sidebar.fields.useCustomIcon')}
              </button>
            </div>

            {/* Favicon Section */}
            {iconSource === 'favicon' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {/* Favicon Preview */}
                  <div
                    className="w-12 h-12 rounded-lg border border-line flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor:
                        customIconUrl && faviconColor
                          ? faviconColor
                          : undefined,
                    }}
                  >
                    {isFetchingFavicon ? (
                      <Loader2
                        strokeWidth={1.5}
                        size={16}
                        className="text-fg-hint animate-spin"
                      />
                    ) : customIconUrl ? (
                      <img
                        src={customIconUrl}
                        alt="Favicon"
                        className="w-7 h-7 object-contain"
                      />
                    ) : (
                      <Globe
                        strokeWidth={1.5}
                        size={16}
                        className="text-fg-hint"
                      />
                    )}
                  </div>

                  {/* Fetch Button */}
                  <button
                    type="button"
                    onClick={() => handleFetchFavicon(url)}
                    disabled={
                      isFetchingFavicon ||
                      !url.trim() ||
                      !isValidUrl(url.trim())
                    }
                    className="flex items-center gap-2 px-3 py-2 text-[13px] bg-field hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-fg-body"
                  >
                    {isFetchingFavicon ? (
                      <Loader2
                        strokeWidth={1.5}
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <RefreshCw strokeWidth={1.5} size={16} />
                    )}
                    {customIconUrl
                      ? t('sections.sidebar.fields.refetchFavicon')
                      : t('sections.sidebar.fields.fetchFavicon')}
                  </button>
                </div>

                {!customIconUrl && !isFetchingFavicon && (
                  <p className="text-xs text-fg-hint">
                    {t('sections.sidebar.fields.faviconHint')}
                  </p>
                )}
              </div>
            )}

            {/* Icon Picker (when using custom icon) */}
            {iconSource === 'icon' && (
              <IconPicker value={iconName} onChange={setIconName} />
            )}
          </div>

          {/* Use Iframe Embedding Checkbox */}
          <div className="flex items-start gap-3 pt-2">
            <input
              id="use-iframe-embedding"
              type="checkbox"
              checked={useIframeEmbedding}
              onChange={(e) => setUseIframeEmbedding(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-line accent-primary text-primary focus:ring-focus"
            />
            <div className="flex flex-col">
              <label
                htmlFor="use-iframe-embedding"
                className="text-[13px] font-medium text-fg cursor-pointer"
              >
                {t('sections.sidebar.fields.useIframeEmbedding')}
              </label>
              <p className="text-xs text-fg-hint">
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
            className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
          >
            {t('common:buttons.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="submit"
            className="h-9 px-3.5 text-[13px] bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
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

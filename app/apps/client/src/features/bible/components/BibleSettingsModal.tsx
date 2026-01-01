import { FileUp, Info, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertModal } from '~/ui/modal'
import { BibleDownloadSection } from './BibleDownloadSection'
import { BibleTranslationsManager } from './BibleTranslationsManager'
import { useImportTranslation } from '../hooks'

interface BibleSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BibleSettingsModal({
  isOpen,
  onClose,
}: BibleSettingsModalProps) {
  const { t } = useTranslation('bible')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [dialogElement, setDialogElement] = useState<HTMLDialogElement | null>(
    null,
  )

  // Callback ref to capture dialog element for portal container
  const setDialogRefCallback = (element: HTMLDialogElement | null) => {
    dialogRef.current = element
    setDialogElement(element)
  }
  const { mutateAsync: importTranslation, isPending: isImporting } =
    useImportTranslation()

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const suggestedName = file.name.replace(/\.xml$/i, '').replace(/-/g, ' ')

      await importTranslation({
        xmlContent: text,
        name: suggestedName,
        abbreviation: suggestedName.substring(0, 10).toUpperCase(),
        language: 'ro',
      })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('import.error'))
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <dialog
        ref={setDialogRefCallback}
        className="fixed inset-0 m-auto w-full max-w-4xl p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
        onClick={handleBackdropClick}
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('settings.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Bible Translations Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <BibleTranslationsManager portalContainer={dialogElement} />
            </div>

            {/* Download Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <BibleDownloadSection portalContainer={dialogElement} />
            </div>

            {/* Import Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileUp className="w-5 h-5" />
                    {t('settings.import.title')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('settings.import.description')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileUp className="w-4 h-4" />
                  )}
                  {t('settings.import.button')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Simplified Format Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {t('settings.import.formatTitle', {
                        defaultValue: 'Supported Formats',
                      })}
                    </p>
                    <p className="text-blue-800 dark:text-blue-200 mb-2">
                      {t('settings.import.formatSimple', {
                        defaultValue:
                          'Upload Bible files in USFX, OSIS, or Zefania XML format. The format is automatically detected.',
                      })}
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      {t('settings.import.formatExamples', {
                        defaultValue: 'For format examples, see:',
                      })}{' '}
                      <a
                        href="https://github.com/radio-crestin/open-bibles"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        github.com/radio-crestin/open-bibles
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </dialog>

      <AlertModal
        isOpen={!!importError}
        title={t('import.errorTitle')}
        message={importError || ''}
        onClose={() => setImportError(null)}
        variant="error"
      />
    </>
  )
}

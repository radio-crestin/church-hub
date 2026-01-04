import { ExternalLink, Replace } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getFrontendUrl,
  isTauri,
} from '~/features/presentation/utils/openDisplayWindow'

interface DuplicateSongModalProps {
  isOpen: boolean
  existingTitle: string
  existingSongId: number | null
  onReplaceExisting: () => void
  onCancel: () => void
}

export function DuplicateSongModal({
  isOpen,
  existingTitle,
  existingSongId,
  onReplaceExisting,
  onCancel,
}: DuplicateSongModalProps) {
  const { t } = useTranslation(['songs', 'common'])
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel()
    }
  }

  const handleOpenInNewWindow = useCallback(async () => {
    if (!existingSongId) return

    const url = `${getFrontendUrl()}/songs/${existingSongId}/edit`

    if (isTauri()) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const windowLabel = `song-preview-${existingSongId}`

        const existingWindow = await WebviewWindow.getByLabel(windowLabel)
        if (existingWindow) {
          await existingWindow.setFocus()
          return
        }

        new WebviewWindow(windowLabel, {
          url,
          title: existingTitle,
          width: 800,
          height: 600,
          center: true,
          resizable: true,
          focus: true,
        })
      } catch {
        window.open(url, '_blank')
      }
    } else {
      window.open(url, '_blank')
    }
  }, [existingSongId, existingTitle])

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-lg"
      onClose={onCancel}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('songs:duplicateDialog.title')}
        </h2>

        <div className="mb-6 text-gray-600 dark:text-gray-400">
          <p className="mb-3">{t('songs:duplicateDialog.foundMessage')}</p>
          <button
            type="button"
            onClick={handleOpenInNewWindow}
            className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            <span>"{existingTitle}"</span>
            <ExternalLink size={16} />
          </button>
          <p className="mt-3 text-sm">
            {t('songs:duplicateDialog.clickToPreview')}
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onReplaceExisting()}
            className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Replace
                size={20}
                className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {t('songs:duplicateDialog.replaceExisting')}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('songs:duplicateDialog.replaceExistingDescription')}
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
        </div>
      </div>
    </dialog>
  )
}

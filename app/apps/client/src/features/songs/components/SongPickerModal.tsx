import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongSearchPicker } from './SongSearchPicker'

interface SongPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSongSelect: (songId: number) => void | Promise<void>
}

/**
 * Standalone song picker dialog, used where a song has to be chosen outside the
 * schedule add-item flow (inserting after an item, resolving missing songs).
 * Shares `SongSearchPicker` with that flow, so both get the same virtualized,
 * incrementally loaded list.
 */
export function SongPickerModal({
  isOpen,
  onClose,
  onSongSelect,
}: SongPickerModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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
      if (!isProcessing) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, isProcessing])

  const handleSongSelect = async (songId: number) => {
    setIsProcessing(true)
    try {
      await onSongSelect(songId)
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      // Near-full-screen with a ~5% margin: searching a song library inside a
      // small box was the main complaint about this picker.
      className="fixed inset-0 m-auto h-[90vh] w-[90vw] max-w-none p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('picker.selectSong')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 flex-col p-4">
          {isProcessing ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <SongSearchPicker
              onSongSelect={handleSongSelect}
              className="flex-1"
            />
          )}
        </div>
      </div>
    </dialog>
  )
}

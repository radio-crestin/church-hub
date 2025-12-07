import { Loader2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useAddToQueue } from '~/features/queue/hooks'
import { useToast } from '~/ui/toast'
import { SongList } from './SongList'

interface SongPickerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Optional: Insert after this queue item ID. If not provided, append to end. */
  afterItemId?: number
  onSongAdded?: () => void
}

export function SongPickerModal({
  isOpen,
  onClose,
  afterItemId,
  onSongAdded,
}: SongPickerModalProps) {
  const { t } = useTranslation(['queue', 'songs'])
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const addToQueue = useAddToQueue()

  // Dialog open/close handling
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!addToQueue.isPending) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, addToQueue.isPending])

  const handleSongSelect = async (songId: number) => {
    const result = await addToQueue.mutateAsync({
      songId,
      afterItemId,
    })

    if (result.success) {
      showToast(t('queue:messages.added'), 'success')
      onSongAdded?.()
      onClose()
    } else {
      showToast(t('queue:messages.error'), 'error')
    }
  }

  const handleClose = () => {
    if (!addToQueue.isPending) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose()
      }}
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('queue:addToQueue.searchSong')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={addToQueue.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {addToQueue.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <SongList onSongClick={handleSongSelect} />
          )}
        </div>
      </div>
    </dialog>
  )
}

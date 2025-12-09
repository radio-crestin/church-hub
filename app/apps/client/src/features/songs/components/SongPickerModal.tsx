import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  /** Optional: Custom handler for song selection. When provided, skips queue-adding. */
  onSongSelect?: (songId: number) => void | Promise<void>
  /** Hide the add to queue behavior (use with onSongSelect) */
  hideAddToQueue?: boolean
}

export function SongPickerModal({
  isOpen,
  onClose,
  afterItemId,
  onSongAdded,
  onSongSelect,
  hideAddToQueue,
}: SongPickerModalProps) {
  const { t } = useTranslation(['queue', 'songs'])
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const addToQueue = useAddToQueue()
  const [isProcessing, setIsProcessing] = useState(false)

  const useCustomHandler = Boolean(onSongSelect || hideAddToQueue)
  const isPending = useCustomHandler ? isProcessing : addToQueue.isPending

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
      if (!isPending) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, isPending])

  const handleSongSelect = async (songId: number) => {
    // Use custom handler if provided
    if (onSongSelect) {
      setIsProcessing(true)
      try {
        await onSongSelect(songId)
        onClose()
      } finally {
        setIsProcessing(false)
      }
      return
    }

    // Default: add to queue
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
    if (!isPending) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-full max-w-lg p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
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
            disabled={isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isPending ? (
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

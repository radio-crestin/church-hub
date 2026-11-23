import { Compass, Loader2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { SameThemeRow } from './SameThemeRow'
import { useSameThemeSongs } from '../hooks/useSameThemeSongs'

interface SameThemeModalProps {
  isOpen: boolean
  onClose: () => void
  songId: number
  songTitle: string
}

/**
 * Other songs on the same theme as the opened one (Christmas, the Cross,
 * the Lord's Supper…), each with the theme and the words they share.
 * Opening one closes the list. Versions of this song stay in Versiuni.
 */
export function SameThemeModal({
  isOpen,
  onClose,
  songId,
  songTitle,
}: SameThemeModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { data: songs = [], isLoading } = useSameThemeSongs(songId, isOpen)

  useEffect(() => {
    if (isOpen) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [isOpen])

  // Escape goes through onClose, so the page's state follows the dialog.
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

  return (
    <dialog
      ref={dialogRef}
      data-testid="same-theme-modal"
      className="fixed inset-0 m-auto w-full max-w-lg rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <Compass className="h-5 w-5 shrink-0 text-violet-500 dark:text-violet-400" />
              {t('sameTheme.title')}
            </h2>
            <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
              {songTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="same-theme-close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={t('sameTheme.close')}
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-[12rem] flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : songs.length === 0 ? (
            <p
              data-testid="same-theme-empty"
              className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              {t('sameTheme.empty')}
            </p>
          ) : (
            <ul className="py-1">
              {songs.map((song) => (
                <SameThemeRow key={song.songId} song={song} onOpen={onClose} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  )
}

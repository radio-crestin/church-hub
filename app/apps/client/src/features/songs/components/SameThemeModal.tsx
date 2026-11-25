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
      className="fixed inset-0 m-auto w-full max-w-lg rounded-xl bg-panel p-0 shadow-popover backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
              <Compass
                className="h-4 w-4 shrink-0 text-fg-label"
                strokeWidth={1.5}
              />
              {t('sameTheme.title')}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-fg-hint">
              {songTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="same-theme-close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
            aria-label={t('sameTheme.close')}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        <div className="min-h-[12rem] flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-fg-hint" />
            </div>
          ) : songs.length === 0 ? (
            <p
              data-testid="same-theme-empty"
              className="px-4 py-6 text-center text-[13px] text-fg-hint"
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

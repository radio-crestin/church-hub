import { X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import type { Song } from '../../songs/types'
import { useUpdateSongKeyLine } from '../hooks/useUpdateSongKeyLine'

export interface KeyLineEditDialogHandle {
  open: (song: Song) => void
  close: () => void
}

export const KeyLineEditDialog = forwardRef<KeyLineEditDialogHandle>(
  function KeyLineEditDialog(_, ref) {
    const { t } = useTranslation('songKey')
    const dialogRef = useRef<HTMLDialogElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [song, setSong] = useState<Song | null>(null)
    const [keyLine, setKeyLine] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const updateMutation = useUpdateSongKeyLine()

    // Lock body scroll and handle viewport changes when dialog is open
    useEffect(() => {
      if (!isOpen) return

      const dialog = dialogRef.current
      if (!dialog) return

      // Lock body scroll to prevent keyboard from moving the list
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'

      const updatePosition = () => {
        const viewport = window.visualViewport
        if (!viewport) return

        // When keyboard opens, viewport.offsetTop increases
        // Add this offset to keep dialog in visible area
        const baseTop = 48 // 3rem base margin
        dialog.style.top = `calc(env(safe-area-inset-top, 0px) + ${baseTop + viewport.offsetTop}px)`
      }

      const viewport = window.visualViewport
      if (viewport) {
        viewport.addEventListener('resize', updatePosition)
        viewport.addEventListener('scroll', updatePosition)
        updatePosition()
      }

      return () => {
        if (viewport) {
          viewport.removeEventListener('resize', updatePosition)
          viewport.removeEventListener('scroll', updatePosition)
        }
        // Restore body scroll
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }, [isOpen])

    const handleClose = () => {
      dialogRef.current?.close()
      setIsOpen(false)
      setSong(null)
      setKeyLine('')
    }

    // Expose imperative methods - open must be called synchronously from user gesture
    useImperativeHandle(ref, () => ({
      open: (songToEdit: Song) => {
        setSong(songToEdit)
        setKeyLine(songToEdit.keyLine || '')
        setIsOpen(true)
        dialogRef.current?.showModal()
        // Use queueMicrotask to focus after DOM update but still within user gesture
        queueMicrotask(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        })
      },
      close: handleClose,
    }))

    const handleSave = async () => {
      if (!song) return

      await updateMutation.mutateAsync({
        songId: song.id,
        songTitle: song.title,
        keyLine: keyLine.trim(),
      })
      handleClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !updateMutation.isPending) {
        e.preventDefault()
        handleSave()
      }
    }

    // Handle click on backdrop to close
    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        handleClose()
      }
    }

    return (
      <dialog
        ref={dialogRef}
        className="fixed p-0 rounded-xl shadow-2xl backdrop:bg-black/50 max-w-md w-[calc(100vw-2rem)]"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          margin: 0,
        }}
        onClose={handleClose}
        onClick={handleBackdropClick}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {t('dialog.title')}
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 space-y-4">
            {song && (
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('dialog.songTitle')}
                </label>
                <p className="text-gray-900 dark:text-white font-medium break-words">
                  {song.title}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="keyLine"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('dialog.keyLine')}
              </label>
              <input
                ref={inputRef}
                id="keyLine"
                type="text"
                inputMode="text"
                enterKeyHint="done"
                autoComplete="off"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                value={keyLine}
                onChange={(e) => {
                  const value = e.target.value
                    .split(' ')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                  setKeyLine(value)
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('dialog.keyLinePlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base
                  focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  touch-manipulation"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 text-base font-medium text-gray-700 dark:text-gray-300
                bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600
                transition-colors min-w-[90px]"
            >
              {t('dialog.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-5 py-2.5 text-base font-medium text-white bg-indigo-600 rounded-lg
                hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[90px]"
            >
              {updateMutation.isPending ? t('dialog.saving') : t('dialog.save')}
            </button>
          </div>
        </div>
      </dialog>
    )
  },
)

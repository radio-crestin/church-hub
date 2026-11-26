import { useNavigate } from '@tanstack/react-router'
import { ExternalLink, X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useId,
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
    const navigate = useNavigate()
    const dialogRef = useRef<HTMLDialogElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    // A page can mount several of these dialogs (song page + program panel),
    // so the input id must be unique for the label to point at the right one.
    const inputId = useId()
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

    const openSong = () => {
      if (!song) return
      handleClose()
      navigate({ to: '/songs/$songId', params: { songId: String(song.id) } })
    }

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
        className="fixed p-0 rounded-xl shadow-popover backdrop:bg-black/50 max-w-md w-[calc(100vw-2rem)]"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          margin: 0,
        }}
        onClose={handleClose}
        onClick={handleBackdropClick}
      >
        <div className="bg-panel rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-line">
            <h2 className="text-base font-semibold text-fg truncate">
              {t('dialog.title')}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('dialog.cancel')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4">
            {song && (
              <div className="min-w-0">
                <p className="mb-1 text-xs text-fg-hint">
                  {t('dialog.songTitle')}
                </p>
                {/* The song itself opens the song page. */}
                <button
                  type="button"
                  onClick={openSong}
                  title={t('dialog.openSong')}
                  data-testid="key-line-open-song"
                  className="group inline-flex max-w-full items-center gap-1.5 rounded text-left text-sm font-medium text-fg hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="break-words">{song.title}</span>
                  <ExternalLink
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="shrink-0 text-fg-hint group-hover:text-fg"
                  />
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor={inputId}
                className="mb-1 block text-xs text-fg-hint"
              >
                {t('dialog.keyLine')}
              </label>
              <input
                ref={inputRef}
                id={inputId}
                data-testid="key-line-input"
                type="text"
                inputMode="text"
                enterKeyHint="done"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                value={keyLine}
                onChange={(e) => setKeyLine(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('dialog.keyLinePlaceholder')}
                className="w-full h-10 px-3 rounded-[10px] border-0 bg-field text-fg text-base md:text-sm
                  focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
                  placeholder:text-fg-hint touch-manipulation"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end items-center gap-2 px-5 py-3 border-t border-line">
            <button
              onClick={handleClose}
              type="button"
              className="h-9 px-4 text-sm font-medium text-fg bg-field rounded-lg hover:bg-hover transition-colors"
            >
              {t('dialog.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="key-line-save"
              type="button"
              className="h-9 px-4 text-sm font-medium text-white bg-primary rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? t('dialog.saving') : t('dialog.save')}
            </button>
          </div>
        </div>
      </dialog>
    )
  },
)

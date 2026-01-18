import { X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { CategoryPicker } from './CategoryPicker'
import { useUpsertSong } from '../hooks'
import type { SongWithSlides } from '../types'

export interface CategoryEditDialogHandle {
  open: (song: SongWithSlides) => void
  close: () => void
}

export const CategoryEditDialog = forwardRef<CategoryEditDialogHandle>(
  function CategoryEditDialog(_, ref) {
    const { t } = useTranslation('songs')
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [song, setSong] = useState<SongWithSlides | null>(null)
    const [categoryId, setCategoryId] = useState<number | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const upsertSong = useUpsertSong()

    // Lock body scroll when dialog is open
    useEffect(() => {
      if (!isOpen) return

      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'

      return () => {
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
      setCategoryId(null)
    }

    useImperativeHandle(ref, () => ({
      open: (songToEdit: SongWithSlides) => {
        setSong(songToEdit)
        setCategoryId(songToEdit.categoryId)
        setIsOpen(true)
        dialogRef.current?.showModal()
      },
      close: handleClose,
    }))

    const handleSave = async () => {
      if (!song) return

      await upsertSong.mutateAsync({
        id: song.id,
        title: song.title,
        categoryId,
      })
      handleClose()
    }

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
              {t('categoryDialog.title')}
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
                  {t('categoryDialog.songTitle')}
                </label>
                <p className="text-gray-900 dark:text-white font-medium break-words">
                  {song.title}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('categoryDialog.category')}
              </label>
              <CategoryPicker
                value={categoryId}
                onChange={setCategoryId}
                portalContainer={dialogRef.current}
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
              {t('categoryDialog.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={upsertSong.isPending}
              className="px-5 py-2.5 text-base font-medium text-white bg-indigo-600 rounded-lg
                hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[90px]"
            >
              {upsertSong.isPending
                ? t('categoryDialog.saving')
                : t('categoryDialog.save')}
            </button>
          </div>
        </div>
      </dialog>
    )
  },
)

import { Loader2, Save, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { CategoryPicker } from './CategoryPicker'
import { type LocalSlide, SongSlideList } from './SongSlideList'
import { useSong, useUpsertSong } from '../hooks'

interface SongMetadata {
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  sourceFilename: string | null
}

const defaultMetadata: SongMetadata = {
  author: null,
  copyright: null,
  ccli: null,
  key: null,
  tempo: null,
  timeSignature: null,
  theme: null,
  altTheme: null,
  hymnNumber: null,
  keyLine: null,
  presentationOrder: null,
  sourceFilename: null,
}

interface SongEditorModalProps {
  isOpen: boolean
  onClose: () => void
  songId: number
  onSaved?: () => void
}

export function SongEditorModal({
  isOpen,
  onClose,
  songId,
  onSaved,
}: SongEditorModalProps) {
  const { t } = useTranslation(['songs', 'common'])
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const { data: song, isLoading } = useSong(songId)
  const upsertMutation = useUpsertSong()

  // Local state for editing
  // NOTE: When adding new fields to song editing, ensure they are:
  // 1. Added to the local state here
  // 2. Initialized from loaded song data in useEffect
  // 3. Included in handleSave mutation call
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [slides, setSlides] = useState<LocalSlide[]>([])
  const [metadata, setMetadata] = useState<SongMetadata>(defaultMetadata)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize local state when song is loaded
  useEffect(() => {
    if (song && isOpen) {
      setTitle(song.title)
      setCategoryId(song.categoryId)
      setSlides(
        song.slides.map((s) => ({
          id: s.id,
          content: s.content,
          sortOrder: s.sortOrder,
          label: s.label,
        })),
      )
      setMetadata({
        author: song.author,
        copyright: song.copyright,
        ccli: song.ccli,
        key: song.key,
        tempo: song.tempo,
        timeSignature: song.timeSignature,
        theme: song.theme,
        altTheme: song.altTheme,
        hymnNumber: song.hymnNumber,
        keyLine: song.keyLine,
        presentationOrder: song.presentationOrder,
        sourceFilename: song.sourceFilename,
      })
      setIsInitialized(true)
    }
  }, [song, isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false)
    }
  }, [isOpen])

  // Dialog open/close handling
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return

    const result = await upsertMutation.mutateAsync({
      id: songId,
      title: title.trim(),
      categoryId,
      slides: slides.map((s, idx) => ({
        id: typeof s.id === 'number' ? s.id : undefined,
        content: s.content,
        sortOrder: idx,
        label: s.label,
      })),
      // Include all metadata fields to preserve them during save
      author: metadata.author,
      copyright: metadata.copyright,
      ccli: metadata.ccli,
      key: metadata.key,
      tempo: metadata.tempo,
      timeSignature: metadata.timeSignature,
      theme: metadata.theme,
      altTheme: metadata.altTheme,
      hymnNumber: metadata.hymnNumber,
      keyLine: metadata.keyLine,
      presentationOrder: metadata.presentationOrder,
    })

    if (result.success && result.data) {
      showToast(t('songs:messages.saved'), 'success')
      // Update local state with saved data
      setSlides(
        result.data.slides.map((s) => ({
          id: s.id,
          content: s.content,
          sortOrder: s.sortOrder,
          label: s.label,
        })),
      )
      setMetadata({
        author: result.data.author,
        copyright: result.data.copyright,
        ccli: result.data.ccli,
        key: result.data.key,
        tempo: result.data.tempo,
        timeSignature: result.data.timeSignature,
        theme: result.data.theme,
        altTheme: result.data.altTheme,
        hymnNumber: result.data.hymnNumber,
        keyLine: result.data.keyLine,
        presentationOrder: result.data.presentationOrder,
      })
      onSaved?.()
      onClose()
    } else {
      showToast(t('songs:messages.error'), 'error')
    }
  }, [
    title,
    categoryId,
    slides,
    metadata,
    songId,
    upsertMutation,
    showToast,
    t,
    onSaved,
    onClose,
  ])

  // CMD+S / Ctrl+S keyboard shortcut to save
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!upsertMutation.isPending) {
          handleSave()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleSave, upsertMutation.isPending])

  const handleClose = () => {
    if (!upsertMutation.isPending) {
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  const showLoading = isLoading || !isInitialized

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleClose}
      onClick={handleBackdropClick}
      className="fixed inset-0 m-auto w-full max-w-4xl p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {showLoading ? (
              <span className="inline-block w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              title || t('songs:editor.titlePlaceholder')
            )}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={upsertMutation.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Song Details */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="modal-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('songs:editor.titlePlaceholder').replace('...', '')}
              </label>
              {showLoading ? (
                <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ) : (
                <input
                  id="modal-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                  placeholder={t('songs:editor.titlePlaceholder')}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('songs:category.name')}
              </label>
              {showLoading ? (
                <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ) : (
                <CategoryPicker value={categoryId} onChange={setCategoryId} />
              )}
            </div>
          </div>

          {/* Slides Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('songs:editor.slides')} ({showLoading ? '-' : slides.length})
            </h3>
            {showLoading ? (
              <div className="space-y-3">
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
            ) : (
              <SongSlideList slides={slides} onSlidesChange={setSlides} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={upsertMutation.isPending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={upsertMutation.isPending || showLoading || !title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {upsertMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t('songs:actions.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}

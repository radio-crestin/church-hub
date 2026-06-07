import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { useLinkSongs } from '../hooks/useLinkSongs'
import { useSearchSongs } from '../hooks/useSearchSongs'

interface LinkVersionsModalProps {
  isOpen: boolean
  onClose: () => void
  /** The song the user is currently viewing — never offered as a match. */
  currentSongId: number
  currentSongTitle: string
  /** Notified after a successful link so the panel can refresh / show toast. */
  onLinked?: () => void
}

/**
 * Lets the user mark another song as a version of the current one. Uses the
 * existing song-search FTS endpoint, filters out the current song to avoid
 * self-links, and falls back to a friendly empty state.
 *
 * Linking is non-destructive — the server's `linkSongs` is idempotent and
 * can be unwound by clicking "Not the same song" on the versions panel.
 */
export function LinkVersionsModal({
  isOpen,
  onClose,
  currentSongId,
  currentSongTitle,
  onLinked,
}: LinkVersionsModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const linkMutation = useLinkSongs()

  const { data: results = [], isLoading } = useSearchSongs(query)
  const candidates = results.filter((r) => r.id !== currentSongId)

  // Mount/unmount the native dialog; reset state on close.
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
      setQuery('')
      setSelectedId(null)
    }
  }, [isOpen])

  // Intercept Escape so we can use our own onClose.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!linkMutation.isPending) onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, linkMutation.isPending])

  async function handleSubmit() {
    if (selectedId === null) return
    try {
      await linkMutation.mutateAsync({
        songIdA: currentSongId,
        songIdB: selectedId,
      })
      onLinked?.()
      onClose()
    } catch {
      // Mutation surfaces the error via `linkMutation.error`.
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-full max-w-lg rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800"
      onClick={(e) => {
        if (e.target === dialogRef.current && !linkMutation.isPending) {
          onClose()
        }
      }}
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('versions.linkModalTitle')}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('versions.linkModalDescription', { title: currentSongTitle })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={linkMutation.isPending}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
            aria-label={t('versions.linkCancel')}
          >
            <X size={20} />
          </button>
        </header>

        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedId(null)
              }}
              placeholder={t('versions.linkSearchPlaceholder')}
              className={`w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
                query ? 'pr-9' : 'pr-3'
              }`}
            />
            {query && (
              <ClearSearchButton
                inputRef={searchInputRef}
                onClear={() => {
                  setQuery('')
                  setSelectedId(null)
                }}
              />
            )}
          </div>
        </div>

        <div className="min-h-[12rem] flex-1 overflow-y-auto">
          {query.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('versions.linkSearchPlaceholder')}
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('versions.emptyPicker')}
            </p>
          ) : (
            <ul className="py-1">
              {candidates.map((song) => (
                <li key={song.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(song.id)}
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      selectedId === song.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-900 dark:text-white">
                        {song.title}
                      </span>
                      {song.categoryName ? (
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {song.categoryName}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {linkMutation.isError ? (
          <p className="px-4 pt-3 text-sm text-red-600 dark:text-red-400">
            {t('versions.linkError', {
              error: linkMutation.error?.message ?? '',
            })}
          </p>
        ) : null}

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={linkMutation.isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t('versions.linkCancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedId === null || linkMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {linkMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {t('versions.linkSubmit')}
          </button>
        </footer>
      </div>
    </dialog>
  )
}

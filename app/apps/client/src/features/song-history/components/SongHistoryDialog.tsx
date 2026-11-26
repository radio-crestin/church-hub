import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { SongHistoryEntryItem } from './SongHistoryEntryItem'
import { useRestoreSongVersion } from '../hooks/useRestoreSongVersion'
import { useSongHistory } from '../hooks/useSongHistory'
import type { RestoreSide } from '../types'

interface SongHistoryDialogProps {
  isOpen: boolean
  onClose: () => void
  songId: number
  songTitle: string
  canRestore: boolean
}

interface PendingRestore {
  entryId: number
  side: RestoreSide
}

/** Who edited the song and when, newest first, with "restore this version". */
export function SongHistoryDialog({
  isOpen,
  onClose,
  songId,
  songTitle,
  canRestore,
}: SongHistoryDialogProps) {
  const { t } = useTranslation('songHistory')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(
    null,
  )
  const { data: entries = [], isLoading } = useSongHistory(songId, isOpen)
  const restoreMutation = useRestoreSongVersion(songId)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (event: Event) => {
      event.preventDefault()
      if (!pendingRestore) onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, pendingRestore])

  async function confirmRestore() {
    if (!pendingRestore) return
    const restore = pendingRestore
    setPendingRestore(null)
    await restoreMutation.mutateAsync(restore).catch(() => undefined)
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid="song-history-dialog"
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl rounded-xl bg-panel p-0 shadow-popover backdrop:bg-black/50"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">{t('title')}</h2>
            <p className="mt-1 truncate text-sm text-fg-hint">
              {t('description', { title: songTitle })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded p-1 text-fg-hint hover:bg-hover"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-[10rem] flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-fg-hint" />
            </div>
          ) : entries.length === 0 ? (
            <p
              className="px-4 py-8 text-center text-sm text-fg-hint"
              data-testid="song-history-empty"
            >
              {t('empty')}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {entries.map((entry) => (
                <SongHistoryEntryItem
                  key={entry.id}
                  entry={entry}
                  canRestore={canRestore && !restoreMutation.isPending}
                  onRestore={(entryId, side) =>
                    setPendingRestore({ entryId, side })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={pendingRestore !== null}
        title={t('restore.confirmTitle')}
        message={t('restore.confirmMessage')}
        confirmLabel={t('restore.confirm')}
        onConfirm={confirmRestore}
        onCancel={() => setPendingRestore(null)}
        testId="song-history-restore-confirm"
      />
    </dialog>
  )
}

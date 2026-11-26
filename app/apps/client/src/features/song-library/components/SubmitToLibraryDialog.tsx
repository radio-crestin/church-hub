import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { SongLibraryError, submitSongToLibrary } from '../service/songLibrary'

interface SubmitToLibraryDialogProps {
  isOpen: boolean
  onClose: () => void
  songId: number
  songTitle: string
}

/** Asks before sending the song to the curators, with an optional note. */
export function SubmitToLibraryDialog({
  isOpen,
  onClose,
  songId,
  songTitle,
}: SubmitToLibraryDialogProps) {
  const { t } = useTranslation('songLibrary')
  const { showToast } = useToast()
  const [note, setNote] = useState('')
  const submit = useMutation({
    mutationFn: () => submitSongToLibrary(songId, note),
    onSuccess: () => {
      showToast(t('submit.sent'), 'success')
      setNote('')
      onClose()
    },
    onError: (error) =>
      showToast(
        error instanceof SongLibraryError && error.code === 'rate_limited'
          ? t('submit.rateLimited')
          : t('submit.failed'),
        'error',
      ),
  })

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('submit.title')}
      message={t('submit.message', { title: songTitle })}
      confirmLabel={t('submit.confirm')}
      onConfirm={() => submit.mutate()}
      onCancel={onClose}
      isLoading={submit.isPending}
      testId="submit-to-library-dialog"
    >
      <label className="block text-xs text-fg-label">
        {t('submit.noteLabel')}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t('submit.notePlaceholder')}
          data-testid="submit-to-library-note"
          className="mt-1 w-full resize-none rounded-[10px] bg-field px-3 py-2 text-base text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus md:text-sm"
        />
      </label>
    </ConfirmModal>
  )
}

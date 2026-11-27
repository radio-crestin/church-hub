import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  countSelectedSongs,
  type SongSelection,
  SongSelectionPicker,
} from '~/features/songs/components/SongSelectionPicker'
import { useCategories } from '~/features/songs/hooks'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { SongLibraryError, submitSongsToLibrary } from '../service/songLibrary'

/** The service takes at most this many songs at once. */
const MAX_SONGS = 500

interface SubmitToLibraryDialogProps {
  isOpen: boolean
  onClose: () => void
  /** What is picked when it opens: the song or category it was opened from. */
  initial: SongSelection
}

/**
 * Sends songs to the curators: the song or category it was opened from,
 * plus any other songs and categories picked, with an optional note.
 */
export function SubmitToLibraryDialog({
  isOpen,
  onClose,
  initial,
}: SubmitToLibraryDialogProps) {
  const { t } = useTranslation('songLibrary')
  const { showToast } = useToast()
  const { data: categories = [] } = useCategories()
  const [selection, setSelection] = useState(initial)
  const [note, setNote] = useState('')
  const count = countSelectedSongs(selection, categories)

  useEffect(() => {
    if (isOpen) setSelection(initial)
  }, [isOpen, initial])

  const submit = useMutation({
    mutationFn: () => submitSongsToLibrary(selection, note),
    onSuccess: ({ submitted }) => {
      showToast(t('submit.sent', { count: submitted }), 'success')
      setNote('')
      onClose()
    },
    onError: (error) => {
      const code = error instanceof SongLibraryError ? error.code : ''
      showToast(
        code === 'rate_limited'
          ? t('submit.rateLimited')
          : code === 'too_many_songs'
            ? t('submit.tooMany', { max: MAX_SONGS })
            : t('submit.failed'),
        'error',
      )
    },
  })

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('submit.title')}
      message={t('submit.message')}
      confirmLabel={t('submit.confirm', { count })}
      onConfirm={() => submit.mutate()}
      onCancel={onClose}
      isLoading={submit.isPending || count === 0 || count > MAX_SONGS}
      testId="submit-to-library-dialog"
    >
      <SongSelectionPicker
        value={selection}
        onChange={setSelection}
        testId="submit-to-library"
      />
      {count > MAX_SONGS && (
        <p className="text-xs text-fg">
          {t('submit.tooMany', { max: MAX_SONGS })}
        </p>
      )}
      <label className="block text-xs text-fg-label">
        {t('submit.noteLabel')}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={2}
          placeholder={t('submit.notePlaceholder')}
          data-testid="submit-to-library-note"
          className="mt-1 w-full resize-none rounded-[10px] bg-field px-3 py-2 text-base text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus md:text-sm"
        />
      </label>
    </ConfirmModal>
  )
}

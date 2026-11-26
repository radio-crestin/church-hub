import { ArrowLeft, Check, Loader2, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { SongEditorBody } from './song-editor/SongEditorBody'
import type { SongEditorMode } from './song-editor/SongEditorModeSwitch'
import { UnsavedChangesModal } from './UnsavedChangesModal'
import { useDeleteSong } from '../hooks/useDeleteSong'
import { useSongDraft } from '../hooks/useSongDraft'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'

interface SongEditorProps {
  /** The song to edit, or null for a new one. */
  songId: number | null
  initialMode: SongEditorMode
  /** Leave the editor (Done): the song page, or the list for a new song. */
  onClose: () => void
  /** A new song was stored for the first time. */
  onCreated: (songId: number) => void
  /** The song was deleted. */
  onDeleted: () => void
}

/**
 * The song editor as a page, opened by the song page's Edit button: the
 * editor (`SongEditorBody`) under a bar with Done, Delete and Save. Nothing is
 * stored until Save (or Ctrl/Cmd+S); leaving with unsaved changes asks first.
 */
export function SongEditor({
  songId,
  initialMode,
  onClose,
  onCreated,
  onDeleted,
}: SongEditorProps) {
  const { t } = useTranslation(['songs', 'common'])
  const { showToast } = useToast()
  const { song, draft, update, isLoading, isDirty, save, isSaving } =
    useSongDraft(songId)
  const deleteSong = useDeleteSong()
  const [mode, setMode] = useState<SongEditorMode>(initialMode)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // A new song moves to its own address once the save has cleared the
  // unsaved state, or the move itself would be stopped as leaving unsaved.
  const [createdId, setCreatedId] = useState<number | null>(null)

  const handleSave = useCallback(async () => {
    if (isSaving) return
    const stored = await save()
    if (!stored) return
    showToast(t('songs:messages.saved'), 'success')
    if (songId === null) setCreatedId(stored.id)
  }, [isSaving, save, showToast, t, songId])

  useEffect(() => {
    if (createdId === null || isDirty) return
    onCreated(createdId)
    setCreatedId(null)
  }, [createdId, isDirty, onCreated])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  const guard = useUnsavedChangesGuard({
    isDirty: isDirty && !isLoading && createdId === null,
  })

  const handleDelete = async () => {
    if (songId === null) return
    setConfirmDelete(false)
    if (await deleteSong.mutateAsync(songId)) {
      showToast(t('songs:messages.deleted'), 'success')
      onDeleted()
    } else {
      showToast(t('songs:messages.error'), 'error')
    }
  }

  const isNew = songId === null
  const canSave = !isSaving && !isLoading && !!draft.title.trim() && isDirty

  return (
    <div
      data-testid="song-editor"
      className="flex h-full flex-col gap-3 lg:h-[calc(100vh-3rem)] lg:overflow-hidden"
    >
      <header
        data-testid="song-editor-header"
        className="sticky top-0 z-20 -mx-3 -mt-2 flex shrink-0 items-center gap-2 bg-app px-3 pb-2 pt-2 sm:-mx-4 sm:px-4 md:-mx-6 md:-mt-3 md:px-6 md:pt-3 lg:static lg:m-0 lg:p-0"
      >
        <button
          type="button"
          onClick={onClose}
          data-testid="song-editor-done"
          title={t('songEditor.done')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-sm font-medium text-fg-body hover:bg-hover"
        >
          <ArrowLeft size={20} />
          <span className="hidden sm:inline">{t('songEditor.done')}</span>
        </button>
        <h1
          data-testid="song-editor-title"
          className="min-w-0 flex-1 truncate text-xl font-bold text-fg lg:text-2xl"
        >
          {isLoading ? (
            <span className="inline-block h-7 w-48 animate-pulse rounded bg-field" />
          ) : (
            draft.title ||
            t(isNew ? 'actions.create' : 'editor.titlePlaceholder')
          )}
        </h1>
        <span
          data-testid="song-editor-status"
          className="hidden shrink-0 items-center gap-1 text-xs text-fg-hint sm:inline-flex"
        >
          {isSaving ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              {t('stageEditor.saving')}
            </>
          ) : isDirty ? (
            t('stageEditor.unsaved')
          ) : (
            <>
              <Check size={13} className="text-green-500" />
              {t('stageEditor.saved')}
            </>
          )}
        </span>
        {!isNew && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteSong.isPending || isLoading}
            data-testid="song-editor-delete"
            title={t('songs:actions.delete')}
            className="shrink-0 rounded-lg p-2 text-fg-hint hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          data-testid="song-editor-save"
          title={`${t('songs:actions.save')} (Ctrl+S)`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {t('songs:actions.save')}
        </button>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-fg" />
        </div>
      ) : (
        <SongEditorBody
          songId={songId}
          draft={draft}
          onChange={update}
          mode={mode}
          onModeChange={setMode}
          isNew={isNew}
          presentationCount={song?.presentationCount}
          lastManualEdit={song?.lastManualEdit}
        />
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        title={t('songs:modal.deleteTitle')}
        message={t('songs:modal.deleteMessage')}
        confirmLabel={t('songs:actions.delete')}
        cancelLabel={t('common:buttons.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
        variant="danger"
      />
      <UnsavedChangesModal
        isOpen={guard.showModal}
        onDiscard={guard.handleDiscard}
        onCancel={guard.handleCancel}
      />
    </div>
  )
}

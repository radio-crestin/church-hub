import { Loader2, Save, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { SongEditorBody } from './song-editor/SongEditorBody'
import type { SongEditorMode } from './song-editor/SongEditorModeSwitch'
import { useSongDraft } from '../hooks/useSongDraft'

interface SongEditorModalProps {
  isOpen: boolean
  onClose: () => void
  songId: number
  onSaved?: () => void
}

/**
 * The song editor in a dialog, for the pencils in Marcaje and Programe: the
 * same editor as the song page's, so a song is edited the same way wherever
 * it is opened from. Saves with its button or Ctrl/Cmd+S, then closes.
 */
export function SongEditorModal({
  isOpen,
  onClose,
  songId,
  onSaved,
}: SongEditorModalProps) {
  return isOpen ? (
    <OpenSongEditorModal songId={songId} onClose={onClose} onSaved={onSaved} />
  ) : null
}

function OpenSongEditorModal({
  songId,
  onClose,
  onSaved,
}: Omit<SongEditorModalProps, 'isOpen'>) {
  const { t } = useTranslation(['songs', 'common'])
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  // The dropdowns inside this dialog must portal INTO it: `showModal()` puts
  // the dialog in the browser's top layer, above every z-index in the body.
  const [dialogEl, setDialogEl] = useState<HTMLDialogElement | null>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [mode, setMode] = useState<SongEditorMode>('slides')
  const { song, draft, update, isLoading, isDirty, save, isSaving } =
    useSongDraft(songId)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const handleSave = useCallback(async () => {
    if (isSaving || !isDirty) return
    if (!(await save())) return
    showToast(t('songs:messages.saved'), 'success')
    onSaved?.()
    onClose()
  }, [isSaving, isDirty, save, showToast, t, onSaved, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  const handleClose = () => {
    if (!isSaving) onClose()
  }

  return (
    <dialog
      ref={(node) => {
        dialogRef.current = node
        setDialogEl(node)
      }}
      onCancel={(e) => {
        e.preventDefault()
        handleClose()
      }}
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target
      }}
      onClick={(e) => {
        // Only a press that starts and ends on the backdrop closes it.
        if (
          e.target === dialogRef.current &&
          mouseDownTargetRef.current === dialogRef.current
        ) {
          handleClose()
        }
      }}
      data-testid="song-editor-modal"
      className="fixed inset-0 z-50 m-auto h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-[110rem] rounded-lg bg-panel p-0 backdrop:bg-black/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="truncate text-lg font-semibold text-fg">
            {isLoading ? (
              <span className="inline-block h-6 w-48 animate-pulse rounded bg-field" />
            ) : (
              draft.title || t('songs:editor.titlePlaceholder')
            )}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label={t('common:buttons.close')}
            className="rounded p-1 hover:bg-hover disabled:opacity-50"
          >
            <X size={20} className="text-fg-hint" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:overflow-hidden">
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
              presentationCount={song?.presentationCount}
              lastManualEdit={song?.lastManualEdit}
              portalContainer={dialogEl}
              idPrefix="modal-"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line p-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-fg-body hover:bg-hover disabled:opacity-50"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoading || !draft.title.trim() || !isDirty}
            data-testid="song-editor-modal-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? (
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

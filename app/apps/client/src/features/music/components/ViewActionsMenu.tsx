import { ListPlus, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ActionMenu, type ActionMenuItem } from '~/ui/menu'
import { ConfirmModal } from '~/ui/modal'
import { NameModal } from './NameModal'
import {
  useDeletePlaylist,
  useRemoveFolder,
  useRenameFolder,
  useSyncFolder,
  useUpsertPlaylist,
} from '../hooks'
import type { LibraryTrack, LibraryView } from '../types'

interface ViewActionsMenuProps {
  view: LibraryView
  name: string
  tracks: LibraryTrack[]
  onAddToQueue: (tracks: LibraryTrack[]) => void
  onRemoved: () => void
}

/** What can be done with the whole view: queue it all, rename or remove it. */
export function ViewActionsMenu({
  view,
  name,
  tracks,
  onAddToQueue,
  onRemoved,
}: ViewActionsMenuProps) {
  const { t } = useTranslation('music')
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const upsertPlaylist = useUpsertPlaylist()
  const deletePlaylist = useDeletePlaylist()
  const renameFolder = useRenameFolder()
  const removeFolder = useRemoveFolder()
  const syncFolder = useSyncFolder()

  const isPlaylist = view.kind === 'playlist'
  const isFolder = view.kind === 'folder'

  const items: ActionMenuItem[] = [
    {
      id: 'queue-all',
      label: t('files.addFolderToQueue'),
      icon: <ListPlus className="h-4 w-4" strokeWidth={1.5} />,
      onSelect: () => onAddToQueue(tracks),
      disabled: tracks.length === 0,
      testId: 'music-view-queue-all',
    },
  ]
  if (isPlaylist || isFolder) {
    items.push({
      id: 'rename',
      label: t('folders.rename'),
      icon: <Pencil className="h-4 w-4" strokeWidth={1.5} />,
      onSelect: () => setDialog('rename'),
      testId: 'music-view-rename',
    })
  }
  if (view.kind === 'folder') {
    items.push({
      id: 'sync',
      label: t('folders.sync'),
      icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} />,
      onSelect: () => syncFolder.mutate(view.id),
      disabled: syncFolder.isPending,
      testId: 'music-view-sync',
    })
  }
  if (isPlaylist || isFolder) {
    items.push({
      id: 'delete',
      label: isPlaylist ? t('playlist.delete') : t('folders.delete'),
      icon: <Trash2 className="h-4 w-4" strokeWidth={1.5} />,
      iconClassName: 'text-red-600 dark:text-red-400',
      onSelect: () => setDialog('delete'),
      testId: 'music-view-delete',
    })
  }

  const rename = (newName: string) => {
    if (view.kind === 'playlist') {
      upsertPlaylist.mutate({ id: view.id, name: newName })
    } else if (view.kind === 'folder') {
      renameFolder.mutate({ id: view.id, name: newName })
    }
    setDialog(null)
  }

  const remove = () => {
    if (view.kind === 'playlist') deletePlaylist.mutate(view.id)
    else if (view.kind === 'folder') removeFolder.mutate(view.id)
    setDialog(null)
    onRemoved()
  }

  return (
    <>
      <ActionMenu
        items={items}
        label={t('tracks.viewActions')}
        size="compact"
        testId="music-view-actions"
      />
      <NameModal
        isOpen={dialog === 'rename'}
        title={t('folders.rename')}
        message={name}
        label={isPlaylist ? t('playlist.name') : t('folders.name')}
        confirmLabel={t('common:buttons.save')}
        initialName={name}
        onConfirm={rename}
        onCancel={() => setDialog(null)}
      />
      <ConfirmModal
        isOpen={dialog === 'delete'}
        title={isPlaylist ? t('playlist.delete') : t('folders.delete')}
        message={
          isPlaylist ? t('playlist.deleteConfirm') : t('folders.deleteConfirm')
        }
        confirmLabel={t('common:buttons.delete')}
        onConfirm={remove}
        onCancel={() => setDialog(null)}
        variant="danger"
      />
    </>
  )
}

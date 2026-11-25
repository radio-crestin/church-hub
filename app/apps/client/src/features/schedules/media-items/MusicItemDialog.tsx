import { Check, Music } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMusicFiles, useMusicFolders } from '~/features/music/hooks'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { ItemDialog } from './ItemDialog'
import { SourceTabs } from './SourceTabs'
import type { MusicItemConfig } from './types'

interface MusicItemDialogProps {
  /** The item's settings when editing one; a new item starts empty. */
  initial?: MusicItemConfig | null
  isSaving: boolean
  onSave: (config: MusicItemConfig) => void
  onClose: () => void
}

/** A music item's settings: a folder or picked tracks, in order or shuffled. */
export function MusicItemDialog({
  initial,
  isSaving,
  onSave,
  onClose,
}: MusicItemDialogProps) {
  const { t } = useTranslation('schedules')
  const [source, setSource] = useState(initial?.source ?? 'folder')
  const [folderId, setFolderId] = useState<number | null>(
    initial?.source === 'folder' ? initial.folderId : null,
  )
  const [fileIds, setFileIds] = useState<number[]>(
    initial?.source === 'tracks' ? initial.fileIds : [],
  )
  const [shuffle, setShuffle] = useState(initial?.shuffle ?? false)
  const [search, setSearch] = useState('')
  const { data: folders = [] } = useMusicFolders()
  const { data: files = [] } = useMusicFiles({
    search: search.trim() || undefined,
    enabled: source === 'tracks',
  })

  const config: MusicItemConfig | null =
    source === 'folder'
      ? folderId === null
        ? null
        : { source, folderId, shuffle }
      : fileIds.length === 0
        ? null
        : { source, fileIds, shuffle }

  const toggleFile = (id: number) =>
    setFileIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    )

  return (
    <ItemDialog
      title={t('mediaItems.music.title')}
      icon={<Music size={20} className="text-pink-500" />}
      testId="music-item-dialog"
      canSave={config !== null}
      isSaving={isSaving}
      onSave={() => config && onSave(config)}
      onClose={onClose}
    >
      <SourceTabs
        testId="music-item-source"
        value={source}
        onChange={setSource}
        options={[
          { value: 'folder', label: t('mediaItems.music.folder') },
          { value: 'tracks', label: t('mediaItems.music.tracks') },
        ]}
      />

      {source === 'folder' ? (
        folders.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('mediaItems.music.noFolders')}
          </p>
        ) : (
          <div className="space-y-1" role="radiogroup">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="radio"
                aria-checked={folder.id === folderId}
                onClick={() => setFolderId(folder.id)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  folder.id === folderId
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <span className="truncate font-medium">{folder.name}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {t('mediaItems.music.trackCount', {
                    count: folder.fileCount,
                  })}
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('mediaItems.music.searchTracks')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('mediaItems.music.picked', { count: fileIds.length })}
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {files.map((file) => {
              const picked = fileIds.indexOf(file.id)
              return (
                <button
                  key={file.id}
                  type="button"
                  role="checkbox"
                  aria-checked={picked >= 0}
                  onClick={() => toggleFile(file.id)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                      picked >= 0
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {picked >= 0 &&
                      (shuffle ? <Check size={12} /> : picked + 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {file.title ?? file.filename}
                    {file.artist && (
                      <span className="text-gray-500"> · {file.artist}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <SwitchRow
        label={t('mediaItems.music.shuffle')}
        description={t('mediaItems.music.shuffleDescription')}
        checked={shuffle}
        onCheckedChange={setShuffle}
        testId="music-item-shuffle"
      />
    </ItemDialog>
  )
}

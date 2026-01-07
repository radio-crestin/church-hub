import {
  ChevronDown,
  ChevronRight,
  Folder,
  ListPlus,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { SearchInput } from './SearchInput'
import { TrackList } from './TrackList'
import { useMusicFiles, useRemoveFolder, useSyncFolder } from '../hooks'
import type { MusicFile, MusicFolder } from '../types'

interface FolderCardProps {
  folder: MusicFolder
  onPlayTrack: (track: MusicFile) => void
  onAddToQueue: (track: MusicFile | MusicFile[]) => void
}

export function FolderCard({
  folder,
  onPlayTrack,
  onAddToQueue,
}: FolderCardProps) {
  const { t } = useTranslation('music')
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const syncFolder = useSyncFolder()
  const removeFolder = useRemoveFolder()
  const { data: files = [], isLoading: isLoadingFiles } = useMusicFiles(
    isExpanded ? folder.id : undefined,
  )

  const filteredFiles = searchQuery
    ? files.filter(
        (file) =>
          file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.artist?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : files

  const handleSync = () => {
    syncFolder.mutate(folder.id)
  }

  const handleDelete = () => {
    removeFolder.mutate(folder.id)
    setShowDeleteConfirm(false)
  }

  const handleAddAllToQueue = () => {
    onAddToQueue(filteredFiles)
  }

  const formattedLastSync = folder.lastSyncAt
    ? t('folders.lastSync', {
        date: new Date(folder.lastSyncAt).toLocaleDateString(),
      })
    : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          <Folder className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-gray-900 dark:text-white">
              {folder.name}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{t('folders.tracks', { count: folder.fileCount })}</span>
              {formattedLastSync && (
                <>
                  <span>•</span>
                  <span>{formattedLastSync}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSync}
              disabled={syncFolder.isPending}
              title={t('folders.sync')}
            >
              {syncFolder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
              onClick={() => setShowDeleteConfirm(true)}
              title={t('folders.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchInput value={searchQuery} onChange={setSearchQuery} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAllToQueue}
                disabled={filteredFiles.length === 0}
              >
                <ListPlus className="mr-2 h-4 w-4" />
                {t('files.addFolderToQueue')}
              </Button>
            </div>

            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            ) : (
              <TrackList
                tracks={filteredFiles}
                onPlay={onPlayTrack}
                onAddToQueue={(track) => onAddToQueue(track)}
              />
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={t('folders.delete')}
        message={t('folders.deleteConfirm')}
        confirmLabel={t('common:delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  )
}

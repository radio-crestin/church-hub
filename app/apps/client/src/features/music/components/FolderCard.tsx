import {
  ChevronDown,
  ChevronRight,
  Folder,
  ListPlus,
  Loader2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { ConfirmModal } from '~/ui/modal'
import { TrackList } from './TrackList'
import {
  useMusicFiles,
  useRemoveFolder,
  useRenameFolder,
  useSyncFolder,
} from '../hooks'
import type { MusicFile, MusicFolder } from '../types'

interface FolderCardProps {
  folder: MusicFolder
  onPlayTrack: (track: MusicFile) => void
  onAddToQueue: (track: MusicFile | MusicFile[]) => void
  searchQuery?: string
}

export function FolderCard({
  folder,
  onPlayTrack,
  onAddToQueue,
  searchQuery = '',
}: FolderCardProps) {
  const { t } = useTranslation('music')
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [newName, setNewName] = useState(folder.name)

  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const prevSearchQueryRef = useRef(searchQuery)

  const syncFolder = useSyncFolder()
  const removeFolder = useRemoveFolder()
  const renameFolder = useRenameFolder()

  // Load files when expanded OR when there's a search query
  const shouldLoadFiles = isExpanded || searchQuery.length > 0
  const { data: files = [], isLoading: isLoadingFiles } = useMusicFiles(
    shouldLoadFiles ? folder.id : undefined,
  )

  const filteredFiles = searchQuery
    ? files.filter(
        (file) =>
          file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.artist?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : files

  // Auto-expand when search query matches files, collapse only when search is cleared
  useEffect(() => {
    const prevQuery = prevSearchQueryRef.current
    prevSearchQueryRef.current = searchQuery

    if (searchQuery && filteredFiles.length > 0 && !isExpanded) {
      setIsExpanded(true)
    } else if (!searchQuery && prevQuery) {
      // Only collapse when search transitions from having value to empty
      setIsExpanded(false)
    }
  }, [searchQuery, filteredFiles.length, isExpanded])

  // Close menu when clicking outside
  useEffect(() => {
    if (!showSettingsMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menuButtonRef.current?.contains(e.target as Node)
      ) {
        setShowSettingsMenu(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettingsMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showSettingsMenu])

  const handleSync = () => {
    syncFolder.mutate(folder.id)
    setShowSettingsMenu(false)
  }

  const handleDelete = () => {
    removeFolder.mutate(folder.id)
    setShowDeleteConfirm(false)
  }

  const handleRename = () => {
    if (newName.trim() && newName !== folder.name) {
      renameFolder.mutate({ id: folder.id, name: newName.trim() })
    }
    setShowRenameModal(false)
  }

  const handleAddAllToQueue = () => {
    onAddToQueue(filteredFiles)
  }

  const handleRowClick = () => {
    setIsExpanded(!isExpanded)
  }

  const openRenameModal = () => {
    setNewName(folder.name)
    setShowRenameModal(true)
    setShowSettingsMenu(false)
  }

  const openDeleteConfirm = () => {
    setShowDeleteConfirm(true)
    setShowSettingsMenu(false)
  }

  const formattedLastSync = folder.lastSyncAt
    ? t('folders.lastSync', {
        date: new Date(folder.lastSyncAt).toLocaleDateString(),
      })
    : null

  // Hide folder if search query doesn't match any files
  if (searchQuery && filteredFiles.length === 0 && !isLoadingFiles) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
            onClick={handleRowClick}
          >
            <span className="h-8 w-8 shrink-0 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>

            <Folder className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-gray-900 dark:text-white">
                {folder.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {searchQuery
                    ? `${filteredFiles.length} / ${folder.fileCount}`
                    : t('folders.tracks', { count: folder.fileCount })}
                </span>
                {formattedLastSync && (
                  <>
                    <span>•</span>
                    <span>{formattedLastSync}</span>
                  </>
                )}
              </div>
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={handleAddAllToQueue}
            disabled={folder.fileCount === 0}
            title={t('files.addFolderToQueue')}
          >
            <ListPlus className="h-4 w-4" />
          </Button>

          <div className="relative shrink-0">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title={t('common:settings')}
            >
              {syncFolder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>

            {showSettingsMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
              >
                <button
                  type="button"
                  onClick={openRenameModal}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Pencil size={14} />
                  {t('folders.rename')}
                </button>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncFolder.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {t('folders.sync')}
                </button>
                <button
                  type="button"
                  onClick={openDeleteConfirm}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} />
                  {t('folders.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="space-y-2 sm:space-y-3">
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

      {/* Rename Modal */}
      {showRenameModal && (
        <dialog
          open
          className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 z-50"
          style={{ maxWidth: '400px' }}
        >
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('folders.rename')}
            </h2>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('folders.name')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setShowRenameModal(false)
              }}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={!newName.trim() || newName === folder.name}
                className="px-4 py-2 rounded-lg font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common:buttons.save')}
              </button>
            </div>
          </div>
        </dialog>
      )}
      {showRenameModal && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowRenameModal(false)}
        />
      )}
    </div>
  )
}

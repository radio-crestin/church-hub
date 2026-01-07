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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/ui/alert-dialog'
import { Button } from '~/ui/button'
import { Card, CardContent, CardHeader } from '~/ui/card'
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
    <Card>
      <CardHeader className="p-4">
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

          <Folder className="h-5 w-5 text-muted-foreground shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{folder.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title={t('folders.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('folders.delete')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('folders.deleteConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t('common:delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
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
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TrackList
                tracks={filteredFiles}
                onPlay={onPlayTrack}
                onAddToQueue={(track) => onAddToQueue(track)}
              />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

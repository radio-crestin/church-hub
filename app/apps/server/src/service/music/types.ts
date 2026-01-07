export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac'

export const SUPPORTED_AUDIO_FORMATS: AudioFormat[] = [
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'flac',
]

export interface MusicFolder {
  id: number
  path: string
  name: string
  isRecursive: boolean
  lastSyncAt: number | null
  fileCount: number
  createdAt: number
  updatedAt: number
}

export interface AddFolderInput {
  path: string
  name?: string
  isRecursive?: boolean
}

export interface MusicFile {
  id: number
  folderId: number
  path: string
  filename: string
  title: string | null
  artist: string | null
  album: string | null
  genre: string | null
  year: number | null
  trackNumber: number | null
  duration: number | null
  format: AudioFormat
  fileSize: number | null
  lastModified: number | null
  createdAt: number
  updatedAt: number
}

export interface MusicFileWithFolder extends MusicFile {
  folder: {
    id: number
    name: string
    path: string
  }
}

export interface GetFilesInput {
  folderId?: number
  search?: string
  artist?: string
  album?: string
  format?: AudioFormat
  limit?: number
  offset?: number
}

export interface MusicPlaylist {
  id: number
  name: string
  description: string | null
  itemCount: number
  totalDuration: number
  createdAt: number
  updatedAt: number
}

export interface UpsertPlaylistInput {
  id?: number
  name: string
  description?: string | null
}

export interface MusicPlaylistItem {
  id: number
  playlistId: number
  fileId: number
  sortOrder: number
  file: MusicFile
  createdAt: number
}

export interface MusicPlaylistWithItems extends MusicPlaylist {
  items: MusicPlaylistItem[]
}

export interface AddToPlaylistInput {
  playlistId: number
  fileId: number
  afterItemId?: number
}

export interface ReorderPlaylistItemsInput {
  itemIds: number[]
}

export interface SyncResult {
  success: boolean
  filesAdded: number
  filesRemoved: number
  filesUpdated: number
  errors: string[]
}

export interface OperationResult {
  success: boolean
  error?: string
}

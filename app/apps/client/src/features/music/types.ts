export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac'

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

export interface MusicPlaylist {
  id: number
  name: string
  description: string | null
  itemCount: number
  totalDuration: number
  createdAt: number
  updatedAt: number
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

export interface SyncResult {
  success: boolean
  filesAdded: number
  filesRemoved: number
  filesUpdated: number
  errors: string[]
}

export interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isShuffled: boolean
  currentIndex: number
}

export interface QueueItem {
  queueId: string
  fileId: number
  path: string
  filename: string
  title?: string
  artist?: string
  album?: string
  duration?: number
}

export interface ServerPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  currentIndex: number
  queueLength: number
  currentTrack: {
    id: number
    fileId: number
    path: string
    filename: string
    title?: string
    artist?: string
    album?: string
    duration?: number
  } | null
  updatedAt: number
}

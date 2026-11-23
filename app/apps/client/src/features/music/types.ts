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
  playCount: number
  lastPlayedAt: number | null
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

export interface QueueItemSummary {
  id: number
  fileId: number
  filename: string
  title?: string
  artist?: string
  duration?: number
}

/** What plays next: as added, at random, or by how often each was played. */
export const QUEUE_ORDERS = [
  'in_order',
  'random',
  'most_played',
  'least_played',
] as const

export type QueueOrder = (typeof QUEUE_ORDERS)[number]

/** What the track list shows: the whole library, the played tracks, a playlist or a folder. */
export type LibraryView =
  | { kind: 'all' }
  | { kind: 'recent' }
  | { kind: 'playlist'; id: number }
  | { kind: 'folder'; id: number }

/** A track in the list; `playlistItemId` when it is listed from a playlist. */
export interface LibraryTrack extends MusicFile {
  playlistItemId?: number
}

export interface ServerPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  queueOrder: QueueOrder
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
  queue: QueueItemSummary[]
  error: string | null
  updatedAt: number
}

export interface MpvStatus {
  available: boolean
  installed: boolean
}

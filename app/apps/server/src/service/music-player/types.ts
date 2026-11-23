/** What plays next: as added, at random, or by how often each was played. */
export type QueueOrder = 'in_order' | 'random' | 'most_played' | 'least_played'

export const QUEUE_ORDERS: QueueOrder[] = [
  'in_order',
  'random',
  'most_played',
  'least_played',
]

export interface QueueItemSummary {
  id: number
  fileId: number
  filename: string
  title?: string
  artist?: string
  duration?: number
}

export interface MusicPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  queueOrder: QueueOrder
  currentIndex: number
  queueLength: number
  currentTrack: CurrentTrack | null
  queue: QueueItemSummary[]
  error: string | null
  updatedAt: number
}

export interface CurrentTrack {
  id: number
  fileId: number
  path: string
  filename: string
  title?: string
  artist?: string
  album?: string
  duration?: number
}

export interface NowPlayingItem {
  id: number
  fileId: number
  sortOrder: number
  createdAt: Date
  file: {
    id: number
    path: string
    filename: string
    title: string | null
    artist: string | null
    album: string | null
    duration: number | null
    playCount: number
  }
}

export type MusicPlayerCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'seek'; time: number }
  | { type: 'volume'; level: number }
  | { type: 'mute'; muted: boolean }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'play_index'; index: number }
  | { type: 'play_file'; fileId: number }

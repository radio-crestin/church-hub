export interface MusicPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  currentIndex: number
  queueLength: number
  currentTrack: CurrentTrack | null
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

export interface MpvPropertyChange {
  name: string
  data: unknown
}

export interface MpvEvent {
  event: string
  id?: number
  name?: string
  data?: unknown
  reason?: string
  error?: string
}

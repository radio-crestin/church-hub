export interface OBSConnectionStatus {
  connected: boolean
  host: string
  port: number
  error?: string
  updatedAt: number
}

export interface OBSStreamingStatus {
  isStreaming: boolean
  isRecording: boolean
  updatedAt: number
}

export interface OBSScene {
  id?: number
  obsSceneName: string
  displayName: string
  isVisible: boolean
  sortOrder: number
  isCurrent: boolean
}

export interface OBSConfig {
  id?: number
  host: string
  port: number
  password: string
  autoConnect: boolean
}

export interface YouTubeAuthStatus {
  isAuthenticated: boolean
  channelId?: string
  channelName?: string
  expiresAt?: number
}

export interface YouTubeConfig {
  id?: number
  titleTemplate: string
  description: string
  privacyStatus: 'public' | 'unlisted' | 'private'
  streamKeyId?: string
  playlistId?: string
  startSceneName?: string
}

export interface BroadcastInfo {
  broadcastId: string
  title: string
  url: string
  status: 'scheduled' | 'live' | 'ended' | 'deleted'
  scheduledStartTime: Date
  actualStartTime?: Date
  endTime?: Date
}

export interface LivestreamStatus {
  isLive: boolean
  broadcastId: string | null
  broadcastUrl: string | null
  title: string | null
  startedAt: number | null
  updatedAt: number
}

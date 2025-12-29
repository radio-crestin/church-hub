import type { ContentType } from './obs/content-types'

export type { ContentType }

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

export interface MixerChannelActions {
  mute: string[]
  unmute: string[]
}

export interface OBSScene {
  id?: number
  obsSceneName: string
  displayName: string
  isVisible: boolean
  sortOrder: number
  shortcuts: string[]
  contentTypes: ContentType[]
  mixerChannelActions: MixerChannelActions
  isCurrent: boolean
  isCustom?: boolean
}

export interface SceneAutomationState {
  isEnabled: boolean
  previousSceneName: string | null
  currentAutoScene: string | null
  lastContentType: ContentType | null
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
  requiresReauth?: boolean
  error?: string
}

export interface YouTubeConfig {
  id?: number
  titleTemplate: string
  description: string
  privacyStatus: 'public' | 'unlisted' | 'private'
  streamKeyId?: string
  playlistId?: string
  startSceneName?: string | null
  stopSceneName?: string | null
  selectedBroadcastId?: string
  broadcastMode: 'create' | 'reuse'
}

export interface UpcomingBroadcast {
  broadcastId: string
  title: string
  scheduledStartTime: Date
  privacyStatus: 'public' | 'unlisted' | 'private'
  url: string
}

export interface BroadcastTemplate {
  id: number
  name: string
  title: string
  description: string
  privacyStatus: 'public' | 'unlisted' | 'private'
  streamKeyId?: string
  playlistId?: string
  category?: string
  usedAt: Date
}

export interface PastBroadcast {
  broadcastId: string
  title: string
  description: string
  privacyStatus: 'public' | 'unlisted' | 'private'
  completedAt: Date
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

export interface MixerConfig {
  id?: number
  host: string
  port: number
  isEnabled: boolean
  channelCount: number
}

export interface MixerChannel {
  id?: number
  channelNumber: number
  label: string
}

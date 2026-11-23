import {
  getNowPlayingQueue,
  getQueueItemAtIndex,
  getQueueLength,
  insertIntoNowPlaying,
} from './now-playing'
import { orderUpcoming } from './queue-order'
import {
  type CurrentTrack,
  type MusicPlayerCommand,
  type MusicPlayerState,
  QUEUE_ORDERS,
  type QueueItemSummary,
  type QueueOrder,
} from './types'
import { recordPlay } from '../music/recordPlay'
import { getSetting, upsertSetting } from '../settings'

const LOG_PREFIX = '[MusicPlayer]'

// Settings keys for persistence
const SETTING_VOLUME = 'music_player_volume'
const SETTING_QUEUE_ORDER = 'music_player_queue_order'
const SETTING_CURRENT_INDEX = 'music_player_current_index'

// Audio server URL (Tauri's embedded rodio audio server; the e2e suite points
// it at a stand-in)
const AUDIO_SERVER_PORT = Number(
  process.env.CHURCH_HUB_AUDIO_SERVER_PORT ?? 3199,
)
const AUDIO_SERVER_URL = `http://127.0.0.1:${AUDIO_SERVER_PORT}`

let stateCallback: ((state: MusicPlayerState) => void) | null = null
let statePollingInterval: ReturnType<typeof setInterval> | null = null
let audioServerAvailable = false

let playerState: MusicPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0,
  isMuted: false,
  queueOrder: 'in_order',
  currentIndex: -1,
  queueLength: 0,
  currentTrack: null,
  queue: [],
  error: null,
  updatedAt: Date.now(),
}

function updateState(partial: Partial<MusicPlayerState>): void {
  playerState = {
    ...playerState,
    ...partial,
    updatedAt: Date.now(),
  }
  stateCallback?.(playerState)
}

async function audioRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }
    const response = await fetch(`${AUDIO_SERVER_URL}${path}`, options)
    return await response.json()
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
    console.error(LOG_PREFIX, `Audio request ${method} ${path} failed:`, error)
    return null
  }
}

function persistPlayerSettings(): void {
  upsertSetting('app_settings', {
    key: SETTING_VOLUME,
    value: String(playerState.volume),
  })
  upsertSetting('app_settings', {
    key: SETTING_QUEUE_ORDER,
    value: playerState.queueOrder,
  })
  upsertSetting('app_settings', {
    key: SETTING_CURRENT_INDEX,
    value: String(playerState.currentIndex),
  })
}

function loadPersistedSettings(): {
  volume: number
  queueOrder: QueueOrder
  currentIndex: number
} {
  const volumeSetting = getSetting('app_settings', SETTING_VOLUME)
  const orderSetting = getSetting('app_settings', SETTING_QUEUE_ORDER)
  const indexSetting = getSetting('app_settings', SETTING_CURRENT_INDEX)

  const volume = volumeSetting ? Number(volumeSetting.value) : 50
  const queueOrder =
    QUEUE_ORDERS.find((order) => order === orderSetting?.value) ?? 'in_order'
  const currentIndex = indexSetting ? Number(indexSetting.value) : -1

  return { volume, queueOrder, currentIndex }
}

/**
 * Poll the audio server for playback state updates.
 */
function startStatePolling(): void {
  if (statePollingInterval) return

  statePollingInterval = setInterval(async () => {
    if (!audioServerAvailable) return

    try {
      const result = (await audioRequest('GET', '/state')) as {
        is_playing: boolean
        current_time: number
        duration: number
        volume: number
        is_muted: boolean
        current_file: string | null
      } | null

      if (!result) return

      const wasPlaying = playerState.isPlaying
      const isNowPlaying = result.is_playing

      updateState({
        isPlaying: isNowPlaying,
        currentTime: result.current_time,
        duration: result.duration > 0 ? result.duration : playerState.duration,
        volume: result.volume,
        isMuted: result.is_muted,
      })

      // Detect track end: was playing, now not playing, and we have a current track
      if (wasPlaying && !isNowPlaying && playerState.currentTrack) {
        // Check if track reached the end (within 0.5s of duration)
        if (
          result.duration > 0 &&
          result.current_time >= result.duration - 0.5
        ) {
          playNext().catch((err) => {
            // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
            console.error(LOG_PREFIX, 'Error playing next track:', err)
          })
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, 500)
}

function stopStatePolling(): void {
  if (statePollingInterval) {
    clearInterval(statePollingInterval)
    statePollingInterval = null
  }
}

async function waitForAudioServer(
  maxRetries = 30,
  delayMs = 500,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${AUDIO_SERVER_URL}/health`)
      if (response.ok) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

export async function initializeMusicPlayer(): Promise<boolean> {
  // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
  console.log(LOG_PREFIX, 'Waiting for audio server...')

  audioServerAvailable = await waitForAudioServer()

  if (!audioServerAvailable) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
    console.warn(
      LOG_PREFIX,
      'Audio server not available, music player disabled',
    )
    return false
  }

  await connectAudioServer()
  return true
}

/**
 * Restores the player's settings and queue on the audio server and starts
 * following its state.
 */
async function connectAudioServer(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
  console.log(LOG_PREFIX, 'Audio server connected')

  // Load persisted settings
  const persisted = loadPersistedSettings()

  // Set volume on audio server
  await audioRequest('POST', '/volume', { level: persisted.volume })

  // Restore persisted state
  updateState({
    volume: persisted.volume,
    queueOrder: persisted.queueOrder,
  })

  // Load persisted queue from database
  refreshQueueState()

  // If there was a persisted currentIndex, restore the track info without auto-playing
  if (persisted.currentIndex >= 0) {
    const queueLen = getQueueLength()
    if (persisted.currentIndex < queueLen) {
      const item = getQueueItemAtIndex(persisted.currentIndex)
      if (item) {
        const currentTrack: CurrentTrack = {
          id: item.id,
          fileId: item.fileId,
          path: item.file.path,
          filename: item.file.filename,
          title: item.file.title ?? undefined,
          artist: item.file.artist ?? undefined,
          album: item.file.album ?? undefined,
          duration: item.file.duration ?? undefined,
        }
        updateState({ currentIndex: persisted.currentIndex, currentTrack })
      }
    }
  }

  // Start polling for state updates
  startStatePolling()

  // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
  console.log(LOG_PREFIX, 'Music player initialized')
}

export function shutdownMusicPlayer(): void {
  // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
  console.log(LOG_PREFIX, 'Shutting down music player')

  stopStatePolling()

  // Stop playback on the audio server
  audioRequest('POST', '/stop').catch(() => {
    // Ignore errors during shutdown
  })

  audioServerAvailable = false

  playerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0,
    isMuted: false,
    queueOrder: 'in_order',
    currentIndex: -1,
    queueLength: 0,
    currentTrack: null,
    queue: [],
    error: null,
    updatedAt: Date.now(),
  }

  // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
  console.log(LOG_PREFIX, 'Music player shutdown complete')
}

async function loadAndPlayFile(filePath: string): Promise<void> {
  await audioRequest('POST', '/play', { path: filePath })
}

// The queue is kept in its chosen order (see setQueueOrder), so the next
// track is always the one after the current.
async function playNext(): Promise<void> {
  const queueLength = getQueueLength()
  const nextIndex = playerState.currentIndex + 1

  if (nextIndex < queueLength) {
    await playAtIndex(nextIndex)
  } else {
    updateState({
      isPlaying: false,
      currentTime: 0,
      currentIndex: -1,
      currentTrack: null,
    })
    persistPlayerSettings()
  }
}

async function playPrevious(): Promise<void> {
  if (playerState.currentTime > 3) {
    await audioRequest('POST', '/seek', { time: 0 })
    return
  }

  const prevIndex = playerState.currentIndex - 1
  if (prevIndex >= 0) {
    await playAtIndex(prevIndex)
  } else {
    await audioRequest('POST', '/seek', { time: 0 })
  }
}

async function playAtIndex(index: number): Promise<void> {
  const item = getQueueItemAtIndex(index)
  if (!item) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
    console.warn(LOG_PREFIX, 'No item at index:', index)
    return
  }

  const currentTrack: CurrentTrack = {
    id: item.id,
    fileId: item.fileId,
    path: item.file.path,
    filename: item.file.filename,
    title: item.file.title ?? undefined,
    artist: item.file.artist ?? undefined,
    album: item.file.album ?? undefined,
    duration: item.file.duration ?? undefined,
  }

  updateState({
    currentIndex: index,
    currentTrack,
    queueLength: getQueueLength(),
  })

  persistPlayerSettings()

  await loadAndPlayFile(item.file.path)
  recordPlay(item.fileId)
  refreshQueueState()
}

/**
 * Plays a track now, keeping the queue: where it already is in the queue,
 * else right after the current one.
 */
async function playFile(fileId: number): Promise<void> {
  const queued = getNowPlayingQueue().findIndex(
    (item) => item.fileId === fileId,
  )
  if (queued !== -1) {
    await playAtIndex(queued)
    return
  }
  const index = playerState.currentIndex + 1
  insertIntoNowPlaying(fileId, index)
  await playAtIndex(index)
}

export async function executeCommand(
  command: MusicPlayerCommand,
): Promise<void> {
  // An audio server that came up after the start is taken on at first use.
  if (!audioServerAvailable && (await waitForAudioServer(1, 0))) {
    audioServerAvailable = true
    await connectAudioServer()
  }
  if (!audioServerAvailable) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for audio
    console.warn(
      LOG_PREFIX,
      `Cannot execute '${command.type}': audio server not available`,
    )
    return
  }

  switch (command.type) {
    case 'play':
      if (playerState.currentIndex === -1 && getQueueLength() > 0) {
        await playAtIndex(0)
      } else {
        await audioRequest('POST', '/resume')
        updateState({ isPlaying: true })
      }
      break

    case 'pause':
      await audioRequest('POST', '/pause')
      updateState({ isPlaying: false })
      break

    case 'stop':
      await audioRequest('POST', '/stop')
      updateState({
        isPlaying: false,
        currentTime: 0,
        currentTrack: null,
        currentIndex: -1,
      })
      persistPlayerSettings()
      break

    case 'seek':
      await audioRequest('POST', '/seek', { time: command.time })
      break

    case 'volume':
      await audioRequest('POST', '/volume', { level: command.level })
      updateState({ volume: command.level })
      persistPlayerSettings()
      break

    case 'mute':
      await audioRequest('POST', '/mute', { muted: command.muted })
      updateState({ isMuted: command.muted })
      break

    case 'next':
      await playNext()
      break

    case 'previous':
      await playPrevious()
      break

    case 'play_index':
      await playAtIndex(command.index)
      break

    case 'play_file':
      await playFile(command.fileId)
      break
  }
}

/**
 * Sets what plays next and orders the tracks after the current one by it.
 * Only the queue changes, so it works with no audio server too.
 */
export function setQueueOrder(order: QueueOrder): void {
  updateState({ queueOrder: order })
  persistPlayerSettings()
  orderUpcoming(order, playerState.currentIndex)
  refreshQueueState()
}

/** Orders newly added tracks among the upcoming ones by the queue order. */
export function applyQueueOrder(): void {
  // In order, a new track simply goes last, where it was added.
  if (playerState.queueOrder === 'in_order') return
  orderUpcoming(playerState.queueOrder, playerState.currentIndex)
}

function getQueueSummary(): QueueItemSummary[] {
  return getNowPlayingQueue().map((item) => ({
    id: item.id,
    fileId: item.fileId,
    filename: item.file.filename,
    title: item.file.title ?? undefined,
    artist: item.file.artist ?? undefined,
    duration: item.file.duration ?? undefined,
  }))
}

export function getPlayerState(): MusicPlayerState {
  const queue = getQueueSummary()
  return {
    ...playerState,
    queueLength: queue.length,
    queue,
  }
}

export function setStateCallback(
  callback: (state: MusicPlayerState) => void,
): void {
  stateCallback = callback
}

export function isPlayerAvailable(): boolean {
  return audioServerAvailable
}

export interface MpvStatus {
  available: boolean
  installed: boolean
}

export function getMpvStatus(): MpvStatus {
  return {
    available: audioServerAvailable,
    installed: true, // Always "installed" since it's embedded in the binary
  }
}

/**
 * Reloads the queue into the state. The current track keeps its place by its
 * id, so removing or reordering tracks before it never changes what plays.
 */
export function refreshQueueState(): void {
  const queue = getQueueSummary()
  const currentId = playerState.currentTrack?.id
  const currentIndex =
    currentId === undefined
      ? playerState.currentIndex
      : queue.findIndex((item) => item.id === currentId)
  updateState({
    queueLength: queue.length,
    queue,
    currentIndex,
    ...(currentIndex === -1 && { currentTrack: null }),
  })
}

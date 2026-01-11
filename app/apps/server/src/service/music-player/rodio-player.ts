import {
  getNowPlayingQueue,
  getQueueItemAtIndex,
  getQueueLength,
} from './now-playing'
import type {
  CurrentTrack,
  MusicPlayerCommand,
  MusicPlayerState,
  QueueItemSummary,
} from './types'
import {
  type AudioStatePayload,
  isAudioControllerConnected,
  sendAudioCommand,
  setAudioFinishedCallback,
  setAudioStateCallback,
} from '../../websocket/audio-controller'

const LOG_PREFIX = '[MusicPlayer]'

let stateCallback: ((state: MusicPlayerState) => void) | null = null

let playerState: MusicPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  isShuffled: false,
  currentIndex: -1,
  queueLength: 0,
  currentTrack: null,
  queue: [],
  updatedAt: Date.now(),
}

function updateState(partial: Partial<MusicPlayerState>): void {
  playerState = {
    ...playerState,
    ...partial,
    updatedAt: Date.now(),
  }
  stateCallback?.(getPlayerState())
}

function handleAudioStateUpdate(audioState: AudioStatePayload): void {
  // Merge audio state from Tauri with our queue state
  updateState({
    isPlaying: audioState.isPlaying,
    currentTime: audioState.currentTime,
    duration: audioState.duration,
    volume: audioState.volume,
    isMuted: audioState.isMuted,
  })
}

function handleAudioFinished(reason: string, error?: string): void {
  // biome-ignore lint/suspicious/noConsole: Server-side logging
  console.log(
    LOG_PREFIX,
    `Audio finished: ${reason}`,
    error ? `Error: ${error}` : '',
  )

  if (reason === 'eof') {
    // Track finished, play next
    playNext()
  } else if (reason === 'error') {
    // Error occurred, try to play next
    // biome-ignore lint/suspicious/noConsole: Server-side logging
    console.error(LOG_PREFIX, 'Playback error, attempting next track')
    playNext()
  }
}

export async function initializeMusicPlayer(): Promise<boolean> {
  // Set up callbacks for audio controller events
  setAudioStateCallback(handleAudioStateUpdate)
  setAudioFinishedCallback(handleAudioFinished)

  // Load persisted queue from database
  refreshQueueState()

  // biome-ignore lint/suspicious/noConsole: Server-side logging
  console.log(LOG_PREFIX, 'Rodio music player service initialized')
  return true
}

export function shutdownMusicPlayer(): void {
  // biome-ignore lint/suspicious/noConsole: Server-side logging
  console.log(LOG_PREFIX, 'Shutting down music player')

  // Send stop command to Tauri
  sendAudioCommand({ type: 'audio_stop' })

  // Reset state
  playerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
    isShuffled: false,
    currentIndex: -1,
    queueLength: 0,
    currentTrack: null,
    queue: [],
    updatedAt: Date.now(),
  }

  // biome-ignore lint/suspicious/noConsole: Server-side logging
  console.log(LOG_PREFIX, 'Music player shutdown complete')
}

async function playNext(): Promise<void> {
  const queueLength = getQueueLength()

  if (queueLength === 0) {
    updateState({
      isPlaying: false,
      currentTime: 0,
      currentIndex: -1,
      currentTrack: null,
    })
    return
  }

  if (playerState.isShuffled && queueLength > 1) {
    // Pick a random index that's different from current
    let randomIndex: number
    do {
      randomIndex = Math.floor(Math.random() * queueLength)
    } while (randomIndex === playerState.currentIndex && queueLength > 1)
    await playAtIndex(randomIndex)
    return
  }

  const nextIndex = playerState.currentIndex + 1

  if (nextIndex < queueLength) {
    await playAtIndex(nextIndex)
  } else {
    // End of queue
    updateState({
      isPlaying: false,
      currentTime: 0,
      currentIndex: -1,
      currentTrack: null,
    })
  }
}

async function playPrevious(): Promise<void> {
  // If more than 3 seconds into the track, restart it
  if (playerState.currentTime > 3) {
    sendAudioCommand({ type: 'audio_seek', payload: { time: 0 } })
    return
  }

  const prevIndex = playerState.currentIndex - 1
  if (prevIndex >= 0) {
    await playAtIndex(prevIndex)
  } else {
    // At the beginning, just restart current track
    sendAudioCommand({ type: 'audio_seek', payload: { time: 0 } })
  }
}

async function playAtIndex(index: number): Promise<void> {
  const item = getQueueItemAtIndex(index)
  if (!item) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging
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

  // Send load command to Tauri audio controller
  const sent = sendAudioCommand({
    type: 'audio_load',
    payload: { path: item.file.path },
  })

  if (!sent) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging
    console.warn(
      LOG_PREFIX,
      'Failed to send load command - audio controller not connected',
    )
  }
}

export async function executeCommand(
  command: MusicPlayerCommand,
): Promise<void> {
  switch (command.type) {
    case 'play':
      if (playerState.currentIndex === -1 && getQueueLength() > 0) {
        await playAtIndex(0)
      } else {
        sendAudioCommand({ type: 'audio_play' })
      }
      break

    case 'pause':
      sendAudioCommand({ type: 'audio_pause' })
      break

    case 'stop':
      sendAudioCommand({ type: 'audio_stop' })
      updateState({
        isPlaying: false,
        currentTime: 0,
        currentTrack: null,
        currentIndex: -1,
      })
      break

    case 'seek':
      sendAudioCommand({ type: 'audio_seek', payload: { time: command.time } })
      break

    case 'volume':
      sendAudioCommand({
        type: 'audio_volume',
        payload: { level: command.level },
      })
      break

    case 'mute':
      sendAudioCommand({
        type: 'audio_mute',
        payload: { muted: command.muted },
      })
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

    case 'shuffle':
      updateState({ isShuffled: command.enabled })
      break
  }
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
  return isAudioControllerConnected()
}

export interface AudioStatus {
  available: boolean
}

export function getAudioStatus(): AudioStatus {
  return {
    available: isAudioControllerConnected(),
  }
}

export function refreshQueueState(): void {
  const queue = getQueueSummary()
  updateState({ queueLength: queue.length, queue })
}

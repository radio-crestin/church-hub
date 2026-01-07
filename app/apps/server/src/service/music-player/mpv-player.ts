import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  getNowPlayingQueue,
  getQueueItemAtIndex,
  getQueueLength,
} from './now-playing'
import type {
  CurrentTrack,
  MpvEvent,
  MusicPlayerCommand,
  MusicPlayerState,
  QueueItemSummary,
} from './types'

const LOG_PREFIX = '[MusicPlayer]'

let mpvProcess: ReturnType<typeof spawn> | null = null
let ipcSocket: net.Socket | null = null
let socketPath: string | null = null
let stateCallback: ((state: MusicPlayerState) => void) | null = null
let statePollingInterval: ReturnType<typeof setInterval> | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

let playerState: MusicPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0,
  isMuted: false,
  isShuffled: false,
  currentIndex: -1,
  queueLength: 0,
  currentTrack: null,
  queue: [],
  updatedAt: Date.now(),
}

function getSocketPath(): string {
  const pid = process.pid
  if (os.platform() === 'win32') {
    return `\\\\.\\pipe\\mpv-socket-${pid}`
  }
  return path.join(os.tmpdir(), `mpv-socket-${pid}`)
}

function updateState(partial: Partial<MusicPlayerState>): void {
  playerState = {
    ...playerState,
    ...partial,
    updatedAt: Date.now(),
  }
  stateCallback?.(playerState)
}

async function sendCommand(command: unknown[]): Promise<void> {
  if (!ipcSocket || ipcSocket.destroyed) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.warn(LOG_PREFIX, 'IPC socket not connected')
    return
  }

  const message = JSON.stringify({ command }) + '\n'

  return new Promise((resolve, reject) => {
    ipcSocket!.write(message, (err) => {
      if (err) {
        // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
        console.error(LOG_PREFIX, 'Failed to send command:', err)
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

function handleMpvEvent(event: MpvEvent): void {
  if (event.event === 'property-change') {
    const { name, data } = event

    switch (name) {
      case 'time-pos':
        if (typeof data === 'number') {
          updateState({ currentTime: data })
        }
        break
      case 'duration':
        if (typeof data === 'number') {
          updateState({ duration: data })
        }
        break
      case 'pause':
        // Only update isPlaying if we have a file loaded
        if (playerState.currentIndex >= 0) {
          updateState({ isPlaying: data === false })
        }
        break
      case 'volume':
        if (typeof data === 'number') {
          updateState({ volume: data })
        }
        break
      case 'mute':
        updateState({ isMuted: data === true })
        break
    }
  } else if (event.event === 'end-file') {
    if (event.reason === 'eof') {
      playNext()
    }
  } else if (event.event === 'file-loaded') {
    updateState({ isPlaying: true })
  }
}

function connectToSocket(): void {
  if (!socketPath) return

  ipcSocket = net.createConnection(socketPath)

  let buffer = ''

  ipcSocket.on('connect', () => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.log(LOG_PREFIX, 'Connected to mpv IPC socket')

    sendCommand(['observe_property', 1, 'time-pos'])
    sendCommand(['observe_property', 2, 'duration'])
    sendCommand(['observe_property', 3, 'pause'])
    sendCommand(['observe_property', 4, 'volume'])
    sendCommand(['observe_property', 5, 'mute'])
  })

  ipcSocket.on('data', (data) => {
    buffer += data.toString()

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        try {
          const event = JSON.parse(line) as MpvEvent
          handleMpvEvent(event)
        } catch {
          // Ignore parse errors
        }
      }
    }
  })

  ipcSocket.on('error', (err) => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.error(LOG_PREFIX, 'IPC socket error:', err.message)
  })

  ipcSocket.on('close', () => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.log(LOG_PREFIX, 'IPC socket closed')
    ipcSocket = null

    if (mpvProcess && !mpvProcess.killed) {
      reconnectTimeout = setTimeout(() => {
        // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
        console.log(LOG_PREFIX, 'Attempting to reconnect to IPC socket')
        connectToSocket()
      }, 1000)
    }
  })
}

export async function initializeMusicPlayer(): Promise<boolean> {
  socketPath = getSocketPath()

  if (os.platform() !== 'win32' && fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath)
  }

  const mpvPath = findMpvPath()
  if (!mpvPath) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.warn(LOG_PREFIX, 'mpv not found, music player disabled')
    return false
  }

  const mpvArgs = [
    '--idle=yes',
    '--no-video',
    '--no-terminal',
    `--input-ipc-server=${socketPath}`,
    '--audio-display=no',
    '--keep-open=no',
    '--volume=0',
  ]

  mpvProcess = spawn(mpvPath, mpvArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  mpvProcess.stdout?.on('data', (data) => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.log(LOG_PREFIX, 'mpv stdout:', data.toString().trim())
  })

  mpvProcess.stderr?.on('data', (data) => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.error(LOG_PREFIX, 'mpv stderr:', data.toString().trim())
  })

  mpvProcess.on('exit', (code) => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.log(LOG_PREFIX, 'mpv process exited with code:', code)
    mpvProcess = null
    updateState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      currentTrack: null,
    })
  })

  mpvProcess.on('error', (err) => {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
    console.error(LOG_PREFIX, 'mpv process error:', err)
    mpvProcess = null
  })

  await new Promise((resolve) => setTimeout(resolve, 500))

  connectToSocket()

  await new Promise((resolve) => setTimeout(resolve, 500))

  // Load persisted queue from database
  refreshQueueState()

  // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
  console.log(LOG_PREFIX, 'Music player initialized')
  return true
}

export function shutdownMusicPlayer(): void {
  // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
  console.log(LOG_PREFIX, 'Shutting down music player')

  if (statePollingInterval) {
    clearInterval(statePollingInterval)
    statePollingInterval = null
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  if (ipcSocket) {
    ipcSocket.destroy()
    ipcSocket = null
  }

  if (mpvProcess && !mpvProcess.killed) {
    mpvProcess.kill('SIGTERM')
    mpvProcess = null
  }

  if (socketPath && os.platform() !== 'win32' && fs.existsSync(socketPath)) {
    try {
      fs.unlinkSync(socketPath)
    } catch {
      // Ignore cleanup errors
    }
  }

  // Keep the queue in database for persistence across restarts

  playerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0,
    isMuted: false,
    isShuffled: false,
    currentIndex: -1,
    queueLength: 0,
    currentTrack: null,
    queue: [],
    updatedAt: Date.now(),
  }

  // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
  console.log(LOG_PREFIX, 'Music player shutdown complete')
}

function findMpvPath(): string | null {
  const platform = os.platform()

  const commonPaths: Record<string, string[]> = {
    darwin: ['/opt/homebrew/bin/mpv', '/usr/local/bin/mpv', '/usr/bin/mpv'],
    linux: ['/usr/bin/mpv', '/usr/local/bin/mpv'],
    win32: [
      'C:\\Program Files\\mpv\\mpv.exe',
      'C:\\Program Files (x86)\\mpv\\mpv.exe',
    ],
  }

  const paths = commonPaths[platform] || []

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  try {
    const which = platform === 'win32' ? 'where' : 'which'
    const result = Bun.spawnSync([which, 'mpv'])
    if (result.exitCode === 0) {
      return result.stdout.toString().trim().split('\n')[0]
    }
  } catch {
    // Ignore
  }

  return null
}

async function loadAndPlayFile(filePath: string): Promise<void> {
  await sendCommand(['loadfile', filePath, 'replace'])
}

async function playNext(): Promise<void> {
  const queueLength = getQueueLength()

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
    updateState({
      isPlaying: false,
      currentTime: 0,
      currentIndex: -1,
      currentTrack: null,
    })
  }
}

async function playPrevious(): Promise<void> {
  if (playerState.currentTime > 3) {
    await sendCommand(['seek', 0, 'absolute'])
    return
  }

  const prevIndex = playerState.currentIndex - 1
  if (prevIndex >= 0) {
    await playAtIndex(prevIndex)
  } else {
    await sendCommand(['seek', 0, 'absolute'])
  }
}

async function playAtIndex(index: number): Promise<void> {
  const item = getQueueItemAtIndex(index)
  if (!item) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging for mpv IPC
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

  await loadAndPlayFile(item.file.path)
}

export async function executeCommand(
  command: MusicPlayerCommand,
): Promise<void> {
  switch (command.type) {
    case 'play':
      if (playerState.currentIndex === -1 && getQueueLength() > 0) {
        await playAtIndex(0)
      } else {
        await sendCommand(['set_property', 'pause', false])
      }
      break

    case 'pause':
      await sendCommand(['set_property', 'pause', true])
      break

    case 'stop':
      await sendCommand(['stop'])
      updateState({
        isPlaying: false,
        currentTime: 0,
        currentTrack: null,
        currentIndex: -1,
      })
      break

    case 'seek':
      await sendCommand(['seek', command.time, 'absolute'])
      break

    case 'volume':
      await sendCommand(['set_property', 'volume', command.level])
      break

    case 'mute':
      await sendCommand(['set_property', 'mute', command.muted])
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
  return mpvProcess !== null && !mpvProcess.killed
}

export interface MpvStatus {
  available: boolean
  installed: boolean
  installInstructions?: {
    mac: string
    windows: string
    linux: string
  }
}

export function getMpvStatus(): MpvStatus {
  const mpvPath = findMpvPath()
  const installed = mpvPath !== null

  if (installed) {
    return {
      available: isPlayerAvailable(),
      installed: true,
    }
  }

  return {
    available: false,
    installed: false,
    installInstructions: {
      mac: 'brew install mpv',
      windows:
        'Download from https://mpv.io/installation/ or use: winget install mpv',
      linux:
        'sudo apt install mpv (Ubuntu/Debian) or sudo dnf install mpv (Fedora)',
    },
  }
}

export function refreshQueueState(): void {
  const queue = getQueueSummary()
  updateState({ queueLength: queue.length, queue })
}

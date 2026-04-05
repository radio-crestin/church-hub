import type { MusicPlayerState } from './types'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test'
import { AudioServerMock } from '../../__tests__/mocks/audio-server-mock'

// =============================================================================
// Unit tests: module behavior without audio server (no DB required)
// =============================================================================

describe('music-player (unit)', () => {
  describe('executeCommand — unavailable audio server', () => {
    test('should guard against unavailable audio server for all commands', async () => {
      const { executeCommand, isPlayerAvailable } = await import('./mpv-player')

      expect(isPlayerAvailable()).toBe(false)

      // All commands should resolve without throwing
      await expect(executeCommand({ type: 'play' })).resolves.toBeUndefined()
      await expect(
        executeCommand({ type: 'play_index', index: 0 }),
      ).resolves.toBeUndefined()
      await expect(executeCommand({ type: 'next' })).resolves.toBeUndefined()
      await expect(
        executeCommand({ type: 'previous' }),
      ).resolves.toBeUndefined()
      await expect(executeCommand({ type: 'pause' })).resolves.toBeUndefined()
      await expect(executeCommand({ type: 'stop' })).resolves.toBeUndefined()
      await expect(
        executeCommand({ type: 'seek', time: 10 }),
      ).resolves.toBeUndefined()
      await expect(
        executeCommand({ type: 'volume', level: 50 }),
      ).resolves.toBeUndefined()
      await expect(
        executeCommand({ type: 'mute', muted: true }),
      ).resolves.toBeUndefined()
      await expect(
        executeCommand({ type: 'shuffle', enabled: true }),
      ).resolves.toBeUndefined()
    })
  })

  describe('isPlayerAvailable', () => {
    test('should return false when not initialized', async () => {
      const { isPlayerAvailable } = await import('./mpv-player')
      expect(isPlayerAvailable()).toBe(false)
    })
  })

  describe('setStateCallback', () => {
    test('should accept a callback function', async () => {
      const { setStateCallback } = await import('./mpv-player')

      expect(() => {
        setStateCallback((_state: MusicPlayerState) => {})
      }).not.toThrow()
    })
  })

  describe('shutdown', () => {
    test('should handle shutdown when not initialized', async () => {
      const { shutdownMusicPlayer } = await import('./mpv-player')
      expect(() => shutdownMusicPlayer()).not.toThrow()
    })

    test('shutdown should be idempotent', async () => {
      const { shutdownMusicPlayer } = await import('./mpv-player')
      expect(() => shutdownMusicPlayer()).not.toThrow()
      expect(() => shutdownMusicPlayer()).not.toThrow()
    })
  })

  describe('getMpvStatus', () => {
    test('should always report installed since audio is embedded', async () => {
      const { getMpvStatus } = await import('./mpv-player')
      const status = getMpvStatus()
      expect(status.installed).toBe(true)
      expect(typeof status.available).toBe('boolean')
    })

    test('should report not available when not initialized', async () => {
      const { getMpvStatus } = await import('./mpv-player')
      const status = getMpvStatus()
      expect(status.available).toBe(false)
    })
  })
})

// =============================================================================
// Source code invariants — verify architectural decisions via file inspection
// =============================================================================

describe('music-player (source invariants)', () => {
  let sourceFile: string

  beforeAll(async () => {
    sourceFile = await Bun.file(`${import.meta.dir}/mpv-player.ts`).text()
  })

  test('should use HTTP to communicate with audio server', () => {
    expect(sourceFile).toContain('AUDIO_SERVER_URL')
    expect(sourceFile).toContain('audioRequest')
    // Must NOT spawn subprocesses or use IPC sockets
    expect(sourceFile).not.toContain('child_process')
    expect(sourceFile).not.toContain('net.createConnection')
    expect(sourceFile).not.toContain('ipcSocket')
  })

  test('should poll state from audio server', () => {
    expect(sourceFile).toContain('startStatePolling')
    expect(sourceFile).toContain('stopStatePolling')
    expect(sourceFile).toContain('/state')
  })

  test('should persist player settings to database', () => {
    expect(sourceFile).toContain('persistPlayerSettings')
    expect(sourceFile).toContain('SETTING_VOLUME')
    expect(sourceFile).toContain('SETTING_SHUFFLE')
    expect(sourceFile).toContain('SETTING_CURRENT_INDEX')
    expect(sourceFile).toContain('upsertSetting')
    expect(sourceFile).toContain('getSetting')
  })

  test('should load persisted settings on init', () => {
    expect(sourceFile).toContain('loadPersistedSettings')
  })

  test('should wait for audio server health check on init', () => {
    expect(sourceFile).toContain('waitForAudioServer')
    expect(sourceFile).toContain('/health')
  })

  test('should detect track end via state polling', () => {
    expect(sourceFile).toContain('wasPlaying')
    expect(sourceFile).toContain('isNowPlaying')
    expect(sourceFile).toContain('playNext')
  })

  test('should handle all 10 music player command types', () => {
    const commands = [
      'play',
      'pause',
      'stop',
      'seek',
      'volume',
      'mute',
      'next',
      'previous',
      'play_index',
      'shuffle',
    ]
    for (const cmd of commands) {
      expect(sourceFile).toContain(`case '${cmd}':`)
    }
  })

  test('should send correct HTTP endpoints to audio server', () => {
    // These are used in audioRequest calls with single quotes
    const quotedEndpoints = [
      '/play',
      '/pause',
      '/resume',
      '/stop',
      '/seek',
      '/volume',
      '/mute',
      '/state',
    ]
    for (const endpoint of quotedEndpoints) {
      expect(sourceFile).toContain(`'${endpoint}'`)
    }
    // /health is used in a template literal
    expect(sourceFile).toContain('/health')
  })

  test('should not use process management (no mpv subprocess)', () => {
    expect(sourceFile).not.toContain('killStaleMpvProcesses')
    expect(sourceFile).not.toContain('cleanupStaleSockets')
    expect(sourceFile).not.toContain('mpvProcess')
    expect(sourceFile).not.toContain('SIGTERM')
    expect(sourceFile).not.toContain('pgrep')
    expect(sourceFile).not.toContain('taskkill')
  })

  test('should always report as installed (embedded in binary)', () => {
    expect(sourceFile).toContain('installed: true')
  })

  test('audioRequest should handle errors gracefully', () => {
    expect(sourceFile).toContain('catch (error)')
    expect(sourceFile).toContain('return null')
  })

  test('should update state with updatedAt timestamp', () => {
    expect(sourceFile).toContain('updatedAt: Date.now()')
  })

  test('should support shuffle with random index selection', () => {
    expect(sourceFile).toContain('Math.random()')
    expect(sourceFile).toContain('isShuffled')
  })

  test('playPrevious should restart track if past 3 seconds', () => {
    expect(sourceFile).toContain('currentTime > 3')
  })

  test('should use state callback for broadcasting updates', () => {
    expect(sourceFile).toContain('stateCallback?.(playerState)')
  })

  test('should stop polling on shutdown', () => {
    expect(sourceFile).toContain('stopStatePolling()')
  })

  test('play at index should build CurrentTrack from queue item', () => {
    expect(sourceFile).toContain('const currentTrack: CurrentTrack')
    expect(sourceFile).toContain('loadAndPlayFile')
  })
})

// =============================================================================
// AudioServerMock tests — verify the mock itself is correct
// =============================================================================

describe('AudioServerMock', () => {
  const mock = new AudioServerMock(13199) // Use different port to avoid conflict

  beforeAll(async () => {
    await mock.start()
  })

  afterAll(async () => {
    await mock.stop()
  })

  beforeEach(() => {
    mock.reset()
  })

  test('GET /health should return ok', async () => {
    const res = await fetch(`${mock.baseUrl}/health`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ ok: true })
  })

  test('GET /state should return default state', async () => {
    const res = await fetch(`${mock.baseUrl}/state`)
    const data = (await res.json()) as {
      is_playing: boolean
      current_time: number
      duration: number
      volume: number
      is_muted: boolean
      current_file: string | null
    }
    expect(data.is_playing).toBe(false)
    expect(data.current_time).toBe(0)
    expect(data.duration).toBe(0)
    expect(data.volume).toBe(50)
    expect(data.is_muted).toBe(false)
    expect(data.current_file).toBeNull()
  })

  test('POST /play should update state with file and duration', async () => {
    const res = await fetch(`${mock.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/test/song.mp3' }),
    })
    expect(res.status).toBe(200)

    const state = mock.getState()
    expect(state.isPlaying).toBe(true)
    expect(state.currentFile).toBe('/test/song.mp3')
    expect(state.currentTime).toBe(0)
    expect(state.duration).toBe(180)
  })

  test('POST /pause should pause playback', async () => {
    mock.setState({ isPlaying: true, currentFile: '/test/song.mp3' })
    await fetch(`${mock.baseUrl}/pause`, { method: 'POST' })
    expect(mock.getState().isPlaying).toBe(false)
  })

  test('POST /resume should resume when file is loaded', async () => {
    mock.setState({ isPlaying: false, currentFile: '/test/song.mp3' })
    await fetch(`${mock.baseUrl}/resume`, { method: 'POST' })
    expect(mock.getState().isPlaying).toBe(true)
  })

  test('POST /resume without current file should not play', async () => {
    await fetch(`${mock.baseUrl}/resume`, { method: 'POST' })
    expect(mock.getState().isPlaying).toBe(false)
  })

  test('POST /stop should reset all playback state', async () => {
    mock.setState({
      isPlaying: true,
      currentFile: '/test/song.mp3',
      currentTime: 42,
      duration: 180,
    })

    await fetch(`${mock.baseUrl}/stop`, { method: 'POST' })

    const state = mock.getState()
    expect(state.isPlaying).toBe(false)
    expect(state.currentTime).toBe(0)
    expect(state.duration).toBe(0)
    expect(state.currentFile).toBeNull()
  })

  test('POST /seek should update currentTime', async () => {
    await fetch(`${mock.baseUrl}/seek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: 99.5 }),
    })
    expect(mock.getState().currentTime).toBe(99.5)
  })

  test('POST /volume should update volume level', async () => {
    await fetch(`${mock.baseUrl}/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 75 }),
    })
    expect(mock.getState().volume).toBe(75)
  })

  test('POST /mute true should mute', async () => {
    await fetch(`${mock.baseUrl}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: true }),
    })
    expect(mock.getState().isMuted).toBe(true)
  })

  test('POST /mute false should unmute', async () => {
    mock.setState({ isMuted: true })
    await fetch(`${mock.baseUrl}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: false }),
    })
    expect(mock.getState().isMuted).toBe(false)
  })

  test('unknown route should return 404', async () => {
    const res = await fetch(`${mock.baseUrl}/unknown`)
    expect(res.status).toBe(404)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Not found')
  })

  test('request log should track all requests with metadata', async () => {
    mock.clearRequestLog()

    await fetch(`${mock.baseUrl}/health`)
    await fetch(`${mock.baseUrl}/state`)
    await fetch(`${mock.baseUrl}/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 50 }),
    })

    const log = mock.getRequestLog()
    expect(log.length).toBe(3)
    expect(log[0].path).toBe('/health')
    expect(log[0].method).toBe('GET')
    expect(log[1].path).toBe('/state')
    expect(log[2].path).toBe('/volume')
    expect(log[2].method).toBe('POST')
    expect((log[2].body as { level: number }).level).toBe(50)
    expect(typeof log[0].timestamp).toBe('number')
  })

  test('getRequestsForPath should filter correctly', async () => {
    mock.clearRequestLog()

    await fetch(`${mock.baseUrl}/health`)
    await fetch(`${mock.baseUrl}/state`)
    await fetch(`${mock.baseUrl}/health`)

    expect(mock.getRequestsForPath('/health').length).toBe(2)
    expect(mock.getRequestsForPath('/state').length).toBe(1)
    expect(mock.getRequestsForPath('/play').length).toBe(0)
  })

  test('setPlayError should make next play fail then recover', async () => {
    mock.setPlayError('File not found')

    const res1 = await fetch(`${mock.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/bad/file.mp3' }),
    })
    expect(res1.status).toBe(500)
    const data1 = (await res1.json()) as { error: string }
    expect(data1.error).toBe('File not found')

    // Next play should succeed (error is one-shot)
    const res2 = await fetch(`${mock.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/good/file.mp3' }),
    })
    expect(res2.status).toBe(200)
  })

  test('setSeekError should make next seek fail then recover', async () => {
    mock.setSeekError('Seek not supported')

    const res1 = await fetch(`${mock.baseUrl}/seek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: 10 }),
    })
    expect(res1.status).toBe(500)

    const res2 = await fetch(`${mock.baseUrl}/seek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: 10 }),
    })
    expect(res2.status).toBe(200)
  })

  test('setState should allow partial updates', async () => {
    mock.setState({ volume: 99 })
    expect(mock.getState().volume).toBe(99)
    // Other fields should remain default
    expect(mock.getState().isPlaying).toBe(false)
  })

  test('reset should restore defaults and clear all logs', async () => {
    mock.setState({ isPlaying: true, volume: 99, currentFile: '/x.mp3' })
    mock.setPlayError('some error')
    await fetch(`${mock.baseUrl}/health`)

    mock.reset()

    const state = mock.getState()
    expect(state.isPlaying).toBe(false)
    expect(state.volume).toBe(50)
    expect(state.currentFile).toBeNull()
    expect(mock.getRequestLog().length).toBe(0)

    // Play error should be cleared too
    const res = await fetch(`${mock.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/test.mp3' }),
    })
    expect(res.status).toBe(200)
  })

  test('full play lifecycle: play → pause → resume → seek → stop', async () => {
    // Play
    await fetch(`${mock.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/music/track.flac' }),
    })
    expect(mock.getState().isPlaying).toBe(true)
    expect(mock.getState().currentFile).toBe('/music/track.flac')

    // Pause
    await fetch(`${mock.baseUrl}/pause`, { method: 'POST' })
    expect(mock.getState().isPlaying).toBe(false)

    // Resume
    await fetch(`${mock.baseUrl}/resume`, { method: 'POST' })
    expect(mock.getState().isPlaying).toBe(true)

    // Seek
    await fetch(`${mock.baseUrl}/seek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: 60 }),
    })
    expect(mock.getState().currentTime).toBe(60)

    // Stop
    await fetch(`${mock.baseUrl}/stop`, { method: 'POST' })
    expect(mock.getState().isPlaying).toBe(false)
    expect(mock.getState().currentFile).toBeNull()
    expect(mock.getState().currentTime).toBe(0)
  })

  test('volume and mute lifecycle', async () => {
    // Set volume
    await fetch(`${mock.baseUrl}/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 80 }),
    })
    expect(mock.getState().volume).toBe(80)

    // Mute
    await fetch(`${mock.baseUrl}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: true }),
    })
    expect(mock.getState().isMuted).toBe(true)
    // Volume should still be 80 (mute doesn't change volume)
    expect(mock.getState().volume).toBe(80)

    // Unmute
    await fetch(`${mock.baseUrl}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: false }),
    })
    expect(mock.getState().isMuted).toBe(false)
  })

  test('GET /state should reflect all mutations', async () => {
    mock.setState({
      isPlaying: true,
      currentTime: 42.5,
      duration: 200,
      volume: 65,
      isMuted: true,
      currentFile: '/path/to/file.ogg',
    })

    const res = await fetch(`${mock.baseUrl}/state`)
    const data = (await res.json()) as {
      is_playing: boolean
      current_time: number
      duration: number
      volume: number
      is_muted: boolean
      current_file: string | null
    }

    expect(data.is_playing).toBe(true)
    expect(data.current_time).toBe(42.5)
    expect(data.duration).toBe(200)
    expect(data.volume).toBe(65)
    expect(data.is_muted).toBe(true)
    expect(data.current_file).toBe('/path/to/file.ogg')
  })
})

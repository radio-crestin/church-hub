import type { MusicPlayerState } from './types'
import { describe, expect, test } from 'bun:test'

// Tests for the music player module which communicates with the
// Tauri audio server (rodio) via HTTP instead of spawning mpv.

describe('music-player', () => {
  describe('executeCommand', () => {
    test('should guard against unavailable audio server', async () => {
      const { executeCommand, isPlayerAvailable } = await import('./mpv-player')

      // Without initialization, audio server is not available
      expect(isPlayerAvailable()).toBe(false)

      // Should not throw when audio server is unavailable
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

      // Should not throw
      expect(() => {
        setStateCallback((_state: MusicPlayerState) => {})
      }).not.toThrow()
    })
  })

  describe('shutdown', () => {
    test('should handle shutdown when not initialized', async () => {
      const { shutdownMusicPlayer } = await import('./mpv-player')

      // Should not throw when nothing is initialized
      expect(() => shutdownMusicPlayer()).not.toThrow()
    })
  })

  describe('getMpvStatus', () => {
    test('should always report installed since audio is embedded', async () => {
      const { getMpvStatus } = await import('./mpv-player')

      const status = getMpvStatus()
      expect(status.installed).toBe(true)
    })
  })

  describe('source code invariants', () => {
    test('should use HTTP to communicate with audio server', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify it uses fetch to communicate with the audio server
      expect(sourceFile).toContain('AUDIO_SERVER_URL')
      expect(sourceFile).toContain('audioRequest')
      // Should NOT spawn processes or use IPC sockets
      expect(sourceFile).not.toContain('spawn(')
      expect(sourceFile).not.toContain('net.createConnection')
      expect(sourceFile).not.toContain('ipcSocket')
    })

    test('should poll state from audio server', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      expect(sourceFile).toContain('startStatePolling')
      expect(sourceFile).toContain('/state')
    })

    test('should persist player settings', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      expect(sourceFile).toContain('persistPlayerSettings')
      expect(sourceFile).toContain('SETTING_VOLUME')
      expect(sourceFile).toContain('SETTING_SHUFFLE')
      expect(sourceFile).toContain('SETTING_CURRENT_INDEX')
    })
  })
})

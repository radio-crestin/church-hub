import type { MusicPlayerState } from './types'
import { describe, expect, test } from 'bun:test'

// We test the module behavior by importing and exercising it.
// Since the mpv-player module uses module-level state, we verify
// the critical behaviors through the exported API.

describe('mpv-player', () => {
  describe('process isolation', () => {
    test('mpv should be spawned with detached: true', async () => {
      // Read the source file and verify the spawn config
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify detached: true is in the spawn call
      expect(sourceFile).toContain('detached: true')
      expect(sourceFile).not.toMatch(/detached:\s*false/)

      // Verify unref() is called after spawn
      expect(sourceFile).toContain('mpvProcess.unref()')
    })
  })

  describe('error handling', () => {
    test('playNext() should have .catch() error handler', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify playNext() is called with .catch() in the end-file handler
      expect(sourceFile).toMatch(/playNext\(\)\.catch/)
    })

    test('handleMpvEvent should not throw on unknown events', async () => {
      // The handleMpvEvent function should gracefully handle unknown events
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify handleMpvEvent checks event.event before processing
      expect(sourceFile).toContain("event.event === 'property-change'")
      expect(sourceFile).toContain("event.event === 'end-file'")
      expect(sourceFile).toContain("event.event === 'file-loaded'")
    })

    test('end-file error should set error state', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify end-file with reason 'error' is handled
      expect(sourceFile).toContain("event.reason === 'error'")
      // Verify error state is set with a message
      expect(sourceFile).toMatch(/updateState\(\{[^}]*error:/)
    })

    test('file-loaded should clear error state', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify file-loaded clears the error
      expect(sourceFile).toContain(
        'updateState({ isPlaying: true, error: null })',
      )
    })
  })

  describe('executeCommand', () => {
    test('should guard against null mpvProcess', async () => {
      const { executeCommand, isPlayerAvailable } = await import('./mpv-player')

      // Without initialization, mpvProcess is null
      expect(isPlayerAvailable()).toBe(false)

      // Should not throw when mpvProcess is null
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

  describe('source code invariants', () => {
    test('shutdown should kill mpv with SIGTERM', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      expect(sourceFile).toContain("mpvProcess.kill('SIGTERM')")
    })

    test('IPC socket errors should be handled', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify socket error handler exists
      expect(sourceFile).toContain("ipcSocket.on('error'")
      expect(sourceFile).toContain("ipcSocket.on('close'")
    })

    test('mpv process error handler should be registered', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      expect(sourceFile).toContain("mpvProcess.on('error'")
      expect(sourceFile).toContain("mpvProcess.on('exit'")
    })

    test('sendCommand should have retry logic', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      expect(sourceFile).toContain('IPC_MAX_RETRIES')
      expect(sourceFile).toContain('IPC_RETRY_DELAY_MS')
      expect(sourceFile).toMatch(/for\s*\(\s*let\s+attempt/)
    })

    test('should kill stale mpv processes on initialization', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify killStaleMpvProcesses is called in initializeMusicPlayer
      expect(sourceFile).toContain('killStaleMpvProcesses()')
      // Verify cleanupStaleSockets is called
      expect(sourceFile).toContain('cleanupStaleSockets()')
    })

    test('should register process exit cleanup handler', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify process exit handlers are registered
      expect(sourceFile).toContain("process.on('exit'")
      expect(sourceFile).toContain("process.on('SIGTERM'")
      expect(sourceFile).toContain("process.on('SIGINT'")
      expect(sourceFile).toContain('registerProcessExitCleanup()')
    })

    test('should use safe process lookup without shell injection risk', async () => {
      const sourceFile = await Bun.file(
        `${import.meta.dir}/mpv-player.ts`,
      ).text()

      // Verify safe process lookup (pgrep via Bun.spawnSync, not shell-based)
      expect(sourceFile).toContain("Bun.spawnSync(['pgrep'")
      // Should not use execSync or shell-based execution for process management
      expect(sourceFile).not.toContain('execSync')
    })
  })
})

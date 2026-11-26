import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const E2E_DIR = dirname(fileURLToPath(import.meta.url))
const SERVER_ENTRY = join(E2E_DIR, '..', '..', 'server', 'src', 'index.ts')

/**
 * On macOS the server could crash at start-up inside CoreMIDI: when the MIDI
 * server was shutting down, the MIDI native module aborted the whole process
 * (T-057). MIDI start-up now checks CoreMIDI safely and retries in a helper.
 */
test.describe('MIDI start-up', () => {
  test('the server answers MIDI requests once it has started', async ({
    request,
  }) => {
    const devices = await request.get('/api/midi/devices')
    expect(devices.ok()).toBe(true)
    const { data } = await devices.json()
    expect(Array.isArray(data.inputs)).toBe(true)
    expect(Array.isArray(data.outputs)).toBe(true)

    const status = await request.get('/api/midi/status')
    expect(status.ok()).toBe(true)
    expect((await request.get('/ping')).ok()).toBe(true)
  })

  test('the CoreMIDI warm-up helper exits without starting a server', () => {
    test.skip(process.platform !== 'darwin', 'CoreMIDI exists only on macOS')

    const startedAt = Date.now()
    const helper = spawnSync('bun', [SERVER_ENTRY, '--warm-up-coremidi'], {
      env: { PATH: process.env.PATH ?? '' },
      encoding: 'utf8',
      timeout: 20_000,
    })

    expect(helper.signal).toBeNull()
    // 0: CoreMIDI gave a client; 2: it refused (the server then retries).
    expect([0, 2]).toContain(helper.status)
    expect(helper.stdout).not.toContain('Server Ready')
    expect(Date.now() - startedAt).toBeLessThan(15_000)
  })
})

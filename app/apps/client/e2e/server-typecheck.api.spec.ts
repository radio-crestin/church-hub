import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * tsc crashed on the server (audify's module-private RtAudioFormat const enum
 * named through `typeof import('audify')`), so the server had no working
 * type-check and its errors piled up unseen (T-146). It must run clean.
 */
test.describe('server type-check', () => {
  test('tsc --noEmit -p apps/server finishes without errors', () => {
    test.setTimeout(600_000)

    const tsc = spawnSync(
      'bun',
      ['x', 'tsc', '--noEmit', '-p', join('apps', 'server')],
      {
        cwd: APP_DIR,
        encoding: 'utf8',
        timeout: 540_000,
        // tsc peaks near 4 GB here; Node sizes its default heap from the
        // machine's RAM, which aborts it on GitHub's 7 GB macOS runner.
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=6144' },
      },
    )

    const output = `${tsc.stderr}\n${tsc.stdout}`.slice(0, 5000)
    expect(tsc.signal, output).toBeNull()
    expect(tsc.status, output).toBe(0)
  })
})

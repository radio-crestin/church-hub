import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'scripts',
  'ensure-audify-prebuild.js',
)

/**
 * The postinstall looked for audify in apps/server/node_modules, but Bun hoists
 * it to app/node_modules, so a missing prebuild went unnoticed behind `|| true`
 * (T-143). The script resolves audify's real folder and finds its module.
 */
test.describe('audify prebuild', () => {
  test('the postinstall finds audify where Bun installed it', () => {
    const run = spawnSync('node', [SCRIPT], {
      encoding: 'utf8',
      timeout: 60_000,
    })

    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain('audify: native module present')
  })
})

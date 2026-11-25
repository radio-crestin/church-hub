import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
)
const GENERATOR = join(REPO_ROOT, 'app', 'scripts', 'generate-changelog.ts')

/**
 * On Windows the generator once ran git through cmd.exe, where its quoted tag
 * pattern matched nothing, and release.sh shipped an empty changelog (T-169).
 * It must list every version tag on every OS.
 */
test.describe('changelog generator', () => {
  test('lists every version tag, never an empty changelog', () => {
    const result = spawnSync('bun', [GENERATOR, '--stdout'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 60_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    expect(result.status, result.stderr).toBe(0)

    const versions: Array<{ version: string }> = JSON.parse(result.stdout)
    const tags = execFileSync('git', ['tag', '--list', 'v[0-9]*'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    })
      .split('\n')
      .filter(Boolean)
    expect(tags.length).toBeGreaterThan(0)
    const listed = new Set(versions.map((v) => `v${v.version}`))
    for (const tag of tags) expect(listed.has(tag), tag).toBe(true)
  })
})

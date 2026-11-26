import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BACKEND_DIR = fileURLToPath(
  new URL('../../../../../churchhub-backend', import.meta.url),
)
const INSTALL_TIMEOUT_MS = 300_000

/**
 * Installs churchhub-backend's npm dependencies on first use: they live
 * outside the app's workspace.
 */
export function installBackendDependencies(): void {
  const manifest = JSON.parse(
    readFileSync(join(BACKEND_DIR, 'package.json'), 'utf8'),
  ) as Record<string, Record<string, string> | undefined>
  const packages = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
  const installed = (name: string) =>
    existsSync(join(BACKEND_DIR, 'node_modules', name))
  if (packages.every(installed)) return
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['ci', '--no-audit', '--no-fund'], {
    cwd: BACKEND_DIR,
    stdio: 'pipe',
    timeout: INSTALL_TIMEOUT_MS,
    // npm.cmd is a batch file: Windows runs it only through a shell.
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(
      `npm ci in churchhub-backend failed:\n${result.stderr?.toString()}`,
    )
  }
}

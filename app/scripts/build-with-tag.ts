#!/usr/bin/env bun
/**
 * Local release build that stamps the artifact with the latest git tag.
 *
 * `tauri build` reads the version from app/tauri/tauri.conf.json — it does NOT
 * look at git tags. So a plain local build ships whatever version happens to be
 * committed, which drifts from the latest release. This wrapper:
 *
 *   1. resolves the latest tag (`git describe --tags --abbrev=0`),
 *   2. temporarily patches tauri.conf.json to that version,
 *   3. runs `tauri build` (which builds the client + native shell, both reading
 *      the patched version),
 *   4. restores tauri.conf.json to its committed content — the working tree is
 *      left clean even if the build fails or is interrupted.
 *
 * Usage (from app/):
 *   bun run tauri:build:release                       # latest tag, all targets
 *   bun run tauri:build:release -- --target <triple>  # extra args pass through
 *
 * Cross-platform: pure Node/Bun APIs, no shell path interpolation.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const APP_DIR = join(import.meta.dir, '..')
const CONF_FILE = join(APP_DIR, 'tauri', 'tauri.conf.json')

let originalConf: string | null = null

/** Restore tauri.conf.json to the content captured before patching. */
function restoreConf(): void {
  if (originalConf !== null) {
    writeFileSync(CONF_FILE, originalConf)
    originalConf = null
  }
}

/** Latest tag without the leading "v", with non-numeric pre-release stripped. */
function latestTagVersion(): string | null {
  try {
    const tag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd: APP_DIR,
      encoding: 'utf-8',
    }).trim()
    // Mirror the CI build: "v0.1.46-beta.2" -> "0.1.46" (MSI/Tauri want bare
    // numeric versions), "v0.1.76" -> "0.1.76".
    return tag.replace(/^v/, '').replace(/-[^0-9].*$/, '')
  } catch {
    return null
  }
}

function main(): void {
  const extraArgs = process.argv.slice(2)
  const version = latestTagVersion()

  if (version) {
    originalConf = readFileSync(CONF_FILE, 'utf-8')
    const patched = originalConf.replace(
      /("version"\s*:\s*)"[^"]*"/,
      `$1"${version}"`,
    )
    if (patched === originalConf) {
      console.log(`tauri.conf.json already at v${version} — building as-is.`)
      originalConf = null // nothing to restore
    } else {
      writeFileSync(CONF_FILE, patched)
      console.log(`Building with latest tag version: v${version}`)
    }
  } else {
    console.warn(
      'No git tags found — building with the version already in tauri.conf.json.',
    )
  }

  // Restore on interruption so a Ctrl-C mid-build never leaves the file patched.
  process.on('SIGINT', () => {
    restoreConf()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    restoreConf()
    process.exit(143)
  })

  try {
    // Reuse the existing, working `tauri build` script so the client/server
    // build (beforeBuildCommand) and native shell all pick up the patched
    // version. `bun run` puts node_modules/.bin on PATH on every OS.
    const result = spawnSync('bun', ['run', 'tauri:build', ...extraArgs], {
      cwd: APP_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1
    }
  } finally {
    restoreConf()
  }
}

main()

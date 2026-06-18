#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: install-time script */
/**
 * Ensures the `audify` native audio binary is present after install.
 *
 * audify ships its binary via `prebuild-install` (an install lifecycle script).
 * Two things make that unreliable here:
 *   1. bun does not run a dependency's install scripts unless it is trusted,
 *      and even then only on a fresh add — not on every `bun install`.
 *   2. audify is hoisted to `<root>/node_modules/audify`, so the old
 *      `cd apps/server/node_modules/audify` postinstall pointed at a path that
 *      doesn't exist (and `|| true` is not valid on Windows cmd anyway).
 *
 * This script is cross-platform (no shell `cd`, no `|| true`): it resolves
 * audify's real directory, and if the compiled `.node` is missing, runs
 * prebuild-install there to fetch the prebuilt binary for the current
 * platform/arch (darwin-arm64/x64, win32-x64, linux-x64). Audio is optional,
 * so any failure only warns — it never fails the whole install.
 */
const { existsSync } = require('node:fs')
const { dirname, join } = require('node:path')
const { execFileSync } = require('node:child_process')

function main() {
  let audifyPkg
  try {
    audifyPkg = require.resolve('audify/package.json')
  } catch {
    // audify not installed (optional dependency) — nothing to do.
    return
  }

  const audifyDir = dirname(audifyPkg)
  const binary = join(audifyDir, 'build', 'Release', 'audify.node')
  if (existsSync(binary)) {
    console.log('[ensure-audify] native binary already present')
    return
  }

  console.log('[ensure-audify] fetching prebuilt audify binary…')
  try {
    // Run the prebuild-install CLI with the current Node/Bun executable so we
    // don't depend on `npx` (whose Windows shim needs a shell).
    const prebuildInstall = require.resolve('prebuild-install/bin.js', {
      paths: [audifyDir, process.cwd()],
    })
    execFileSync(process.execPath, [prebuildInstall, '-r', 'napi'], {
      cwd: audifyDir,
      stdio: 'inherit',
    })
    if (existsSync(binary)) {
      console.log('[ensure-audify] installed audify native binary')
    } else {
      console.warn(
        '[ensure-audify] prebuild-install completed but no binary was produced',
      )
    }
  } catch (err) {
    console.warn(
      '[ensure-audify] could not install the audify native binary; ' +
        'live-translation audio will be unavailable on this machine. ' +
        String(err && err.message ? err.message : err),
    )
  }
}

main()

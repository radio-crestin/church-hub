#!/usr/bin/env node
/**
 * Makes sure audify's native module (build/Release/audify.node) is there after
 * `bun install` (postinstall). Bun hoists audify to app/node_modules, so its
 * folder is resolved, never assumed. When the module is missing, its prebuild
 * is downloaded there (prebuild-install -r napi); a failure is reported and
 * fails the install instead of leaving the sidecar without audio.
 *
 * Cross-platform: execFileSync with an argument array, no shell.
 */

// biome-ignore-all lint/suspicious/noConsole: the install's own output

const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { dirname, join } = require('node:path')

const audify = dirname(require.resolve('audify/package.json'))
const nativeModule = join(audify, 'build', 'Release', 'audify.node')

if (existsSync(nativeModule)) {
  console.log(`audify: native module present (${nativeModule})`)
  process.exit(0)
}

const prebuildInstall = require.resolve('prebuild-install/bin.js', {
  paths: [audify],
})
try {
  execFileSync(process.execPath, [prebuildInstall, '-r', 'napi'], {
    cwd: audify,
    stdio: 'inherit',
    timeout: 120_000,
  })
} catch (error) {
  console.error(
    `audify: prebuild-install failed in ${audify}: ${error.message}`,
  )
  process.exit(1)
}
if (!existsSync(nativeModule)) {
  console.error(
    `audify: prebuild-install ran but ${nativeModule} is still missing`,
  )
  process.exit(1)
}
console.log(`audify: native module installed (${nativeModule})`)

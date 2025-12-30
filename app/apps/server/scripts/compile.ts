/** biome-ignore-all lint/suspicious/noConsole: <> */

/**
 * Compile the packages/server to use as a sidecar in Tauri
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { $ } from 'bun'

import packageJson from '../../../package.json'

const ARCHITECTURES = {
  x64: 'x64',
  arm64: 'aarch64',
} as const

const BINARIES_POSTFIX: Record<
  string,
  Record<keyof typeof ARCHITECTURES, string>
> = {
  darwin: {
    x64: 'x86_64-apple-darwin',
    arm64: 'aarch64-apple-darwin',
  },
  linux: {
    x64: 'x86_64-unknown-linux-gnu',
    arm64: 'aarch64-unknown-linux-gnu',
  },
  win32: {
    x64: 'x86_64-pc-windows-msvc.exe',
    arm64: 'i686-pc-windows-msvc.exe',
  },
} as const

// Maps OS/arch to MIDI prebuild folder names
const MIDI_PREBUILD_NAMES: Record<string, Record<string, string>> = {
  darwin: {
    x64: 'midi-darwin-x64',
    arm64: 'midi-darwin-arm64',
  },
  linux: {
    x64: 'midi-linux-x64',
    arm64: 'midi-linux-arm64',
  },
  win32: {
    x64: 'midi-win32-x64',
    arm64: 'midi-win32-arm64',
  },
} as const

const BINARY_NAME = `${packageJson.name}-sidecar`
const OUTDIR = path.join(__dirname, '..', '..', '..', 'tauri', 'bin')
const RESOURCES_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'tauri',
  'resources',
)
const OUTFILE = `${OUTDIR}/${BINARY_NAME}-{binary_postfix}`

/**
 * Copies MIDI native module prebuilds for the current platform to the resources folder
 */
function copyMidiPrebuilds(os: string, arch: string): void {
  const prebuildName = MIDI_PREBUILD_NAMES[os]?.[arch]
  if (!prebuildName) {
    console.log(`\x1b[33mNo MIDI prebuild available for ${os}/${arch}\x1b[0m`)
    return
  }

  const midiPrebuildsDir = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'node_modules',
    '@julusian',
    'midi',
    'prebuilds',
  )

  const sourceDir = path.join(midiPrebuildsDir, prebuildName)
  const sourceFile = path.join(sourceDir, 'node-napi-v7.node')

  if (!existsSync(sourceFile)) {
    console.log(`\x1b[33mMIDI prebuild not found at ${sourceFile}\x1b[0m`)
    return
  }

  // Create resources/midi-native directory if it doesn't exist
  const destDir = path.join(RESOURCES_DIR, 'midi-native')
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  // Copy the native module with a platform-specific name
  const destFile = path.join(destDir, 'midi.node')
  copyFileSync(sourceFile, destFile)
  console.log(
    `\x1b[32mCopied MIDI native module:\x1b[0m ${sourceFile} -> ${destFile}`,
  )
}

async function main() {
  const os = process.platform as keyof typeof BINARIES_POSTFIX
  const arch = process.arch as keyof typeof ARCHITECTURES

  const binary_postfix = BINARIES_POSTFIX[os]?.[arch]

  if (!binary_postfix) {
    throw new Error(
      `Could not find the binary label for OS="${os}" ARCHITECTURE="{arch}"`,
    )
  }

  const outfile = OUTFILE.replace('{binary_postfix}', binary_postfix)

  console.log(`\x1b[36mDetected:\x1b[0m ${os} (\x1b[33m${arch}\x1b[0m)`)
  console.log(`\x1b[36mOutput binary:\x1b[0m ${outfile}`)

  // Generate embedded migrations before compiling
  console.log('\x1b[34mGenerating embedded migrations...\x1b[0m')
  await $`bun run ${path.join(__dirname, 'generate-embedded-migrations.ts')}`

  // Copy MIDI native modules to resources folder
  console.log('\x1b[34mCopying MIDI native modules...\x1b[0m')
  copyMidiPrebuilds(os, arch)

  console.log('\x1b[34mCompiling server with Bun...\x1b[0m')
  await $`bun build --compile --production --minify --minify-syntax --target bun --bundle ./src/index.ts --outfile ${outfile}`

  console.log('\x1b[32mDone! Binary created at:\x1b[0m', outfile)
}

main().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})

import { existsSync } from 'node:fs'

import { getChromaNativeModulePath } from '../../utils/paths'

/**
 * Maps the current platform/arch to the chromadb-js-bindings npm package name.
 * NOTE: chromadb's own dist/cli.mjs has a broken win32 branch (only loads
 * arm64), so we resolve the binding ourselves with proper branching.
 */
export function getChromaBindingPackageName(): string {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    if (arch === 'arm64') return 'chromadb-js-bindings-darwin-arm64'
    if (arch === 'x64') return 'chromadb-js-bindings-darwin-x64'
    throw new Error(`Unsupported macOS architecture for Chroma: ${arch}`)
  }
  if (platform === 'win32') {
    if (arch === 'x64') return 'chromadb-js-bindings-win32-x64-msvc'
    throw new Error(`Unsupported Windows architecture for Chroma: ${arch}`)
  }
  if (platform === 'linux') {
    if (arch === 'x64') return 'chromadb-js-bindings-linux-x64-gnu'
    if (arch === 'arm64') return 'chromadb-js-bindings-linux-arm64-gnu'
    throw new Error(`Unsupported Linux architecture for Chroma: ${arch}`)
  }
  throw new Error(`Unsupported platform for Chroma: ${platform}`)
}

interface ChromaBinding {
  cli: (args: string[]) => void
}

/**
 * Loads the Chroma NAPI binding.
 * In production the .node file is bundled under resources/chroma-native/
 * (copied per-OS by scripts/compile.ts); in development it resolves from
 * node_modules.
 */
export function loadChromaBinding(): ChromaBinding {
  const bundledPath = getChromaNativeModulePath()
  if (bundledPath && existsSync(bundledPath)) {
    return require(bundledPath) as ChromaBinding
  }
  return require(getChromaBindingPackageName()) as ChromaBinding
}

import { dirname, join } from 'node:path'

import { getDatabasePath } from '../../../../utils/paths'

/**
 * Folder holding the Inworld helper's venv, weights and benchmark, next to the
 * database so it follows `DATABASE_PATH` (e2e runs keep their own).
 * `CHURCH_HUB_VOICE_ISOLATOR_DIR` overrides it.
 */
export function getInworldDir(): string {
  return (
    process.env.CHURCH_HUB_VOICE_ISOLATOR_DIR ||
    join(dirname(getDatabasePath()), 'voice-isolator')
  )
}

export function getVenvDir(): string {
  return join(getInworldDir(), 'venv')
}

/** The venv's interpreter: `Scripts\python.exe` on Windows, `bin/python` elsewhere. */
export function getVenvPython(): string {
  return process.platform === 'win32'
    ? join(getVenvDir(), 'Scripts', 'python.exe')
    : join(getVenvDir(), 'bin', 'python')
}

export function getWeightsDir(): string {
  return join(getInworldDir(), 'weights')
}

export function getWeightsPath(): string {
  return join(getWeightsDir(), 'denoiser_realtime.safetensors')
}

export function getBenchmarkPath(): string {
  return join(getInworldDir(), 'benchmark.json')
}

/** Written once the package is installed: the release it holds. */
export function getInstalledMarkerPath(): string {
  return join(getInworldDir(), 'installed.txt')
}

/** Written once the venv has pip. */
export function getVenvMarkerPath(): string {
  return join(getVenvDir(), 'church-hub-pip.txt')
}

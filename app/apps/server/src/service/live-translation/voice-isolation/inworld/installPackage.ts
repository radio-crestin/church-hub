import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { isVenvReady } from './createVenv'
import { getInstalledMarkerPath, getVenvPython } from './inworldPaths'
import { runProcess } from './runProcess'

/** The helper is written against this release of the package. */
const PACKAGE = 'inworld-voice-isolation==1.0.0'

function hasNvidiaGpu(): boolean {
  try {
    execFileSync('nvidia-smi', ['-L'], { stdio: 'pipe', timeout: 10000 })
    return true
  } catch {
    return false
  }
}

/**
 * Where PyTorch comes from, null for PyPI. PyPI's Windows wheel is CPU-only,
 * so an NVIDIA GPU there takes the CUDA build; PyPI's Linux wheel bundles CUDA
 * (gigabytes), so Linux without one takes the CPU build. macOS's PyPI wheel
 * runs on Apple's GPU (mps).
 */
function torchIndexUrl(): string | null {
  if (process.platform === 'darwin') return null
  const nvidia = hasNvidiaGpu()
  if (process.platform === 'win32') {
    return nvidia ? 'https://download.pytorch.org/whl/cu128' : null
  }
  return nvidia ? null : 'https://download.pytorch.org/whl/cpu'
}

/** Installs PyTorch (for this machine's GPU) and the package into the venv. */
export async function installPackage(): Promise<void> {
  const pip = ['-m', 'pip', 'install', '--disable-pip-version-check']
  const index = torchIndexUrl()
  if (index) {
    await runProcess(getVenvPython(), [
      ...pip,
      'torch',
      'torchaudio',
      '--index-url',
      index,
    ])
  }
  await runProcess(getVenvPython(), [...pip, PACKAGE])
  writeFileSync(getInstalledMarkerPath(), PACKAGE)
}

/** Whether this release of the package went into the venv (its marker). */
export function isPackageInstalled(): boolean {
  return (
    isVenvReady() &&
    existsSync(getInstalledMarkerPath()) &&
    readFileSync(getInstalledMarkerPath(), 'utf8') === PACKAGE
  )
}

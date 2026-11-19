import { readBenchmark, writeBenchmark } from './benchmark'
import { createVenv, isVenvReady } from './createVenv'
import { systemPythonLabel } from './findSystemPython'
import { installPackage, isPackageInstalled } from './installPackage'
import { inworldLogger as logger } from './inworldLogger'
import { getWeightsDir, getWeightsPath } from './inworldPaths'
import { isInworldReady } from './isInworldReady'
import { runHelper } from './runHelper'
import type { InworldSetupProgress, InworldStatus } from '../types'

let progress: InworldSetupProgress | null = null
let lastError: string | undefined
let running: Promise<void> | null = null

/**
 * Sets the helper up, each step skipped when already done: the venv, the
 * package (PyTorch included), the weights (with progress), then a benchmark
 * of the real-time factor on this machine.
 */
async function setup(): Promise<void> {
  if (!isVenvReady()) {
    progress = { step: 'venv' }
    await createVenv()
  }
  if (!isPackageInstalled()) {
    progress = { step: 'install' }
    await installPackage()
  }
  progress = { step: 'download' }
  await runHelper(['download', '--dest', getWeightsDir()], (event) => {
    if (event.event === 'progress') {
      progress = {
        step: 'download',
        received: event.received,
        total: event.total,
      }
    }
  })
  progress = { step: 'benchmark' }
  await runHelper(['bench', '--weights', getWeightsPath()], (event) => {
    if (event.event === 'bench' && event.device && event.rtf !== undefined) {
      writeBenchmark({ device: event.device, realTimeFactor: event.rtf })
      logger.info('Inworld benchmark', event)
    }
  })
}

/** Starts the setup, or returns the one already running. */
export function startInworldSetup(): Promise<void> {
  if (running) return running
  lastError = undefined
  running = setup()
    .catch((error: unknown) => {
      lastError = error instanceof Error ? error.message : String(error)
      logger.error('Inworld setup failed', { error: lastError })
    })
    .finally(() => {
      progress = null
      running = null
    })
  return running
}

export function getInworldStatus(): InworldStatus {
  const benchmark = readBenchmark()
  return {
    python: systemPythonLabel(),
    installed: isPackageInstalled(),
    modelReady: isInworldReady(),
    device: benchmark?.device,
    realTimeFactor: benchmark?.realTimeFactor,
    setup: progress,
    error: lastError,
  }
}

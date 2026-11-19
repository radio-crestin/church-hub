import { existsSync } from 'node:fs'

import { readBenchmark } from './benchmark'
import { isPackageInstalled } from './installPackage'
import { getWeightsPath } from './inworldPaths'

/** Installed, weights downloaded and benchmarked: the helper can stream. */
export function isInworldReady(): boolean {
  return (
    isPackageInstalled() &&
    existsSync(getWeightsPath()) &&
    readBenchmark() !== null
  )
}

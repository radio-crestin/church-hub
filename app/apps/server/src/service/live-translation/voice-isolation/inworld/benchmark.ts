import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { getBenchmarkPath } from './inworldPaths'

export interface Benchmark {
  device: string
  /** Seconds of compute per second of audio: below 1 keeps up live. */
  realTimeFactor: number
}

export function readBenchmark(): Benchmark | null {
  if (!existsSync(getBenchmarkPath())) return null
  return JSON.parse(readFileSync(getBenchmarkPath(), 'utf8')) as Benchmark
}

export function writeBenchmark(benchmark: Benchmark): void {
  writeFileSync(getBenchmarkPath(), JSON.stringify(benchmark))
}

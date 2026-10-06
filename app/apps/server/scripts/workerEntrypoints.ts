/**
 * The sidecar's worker threads. In the compiled sidecar a worker is found by
 * its path from src/ (see songUpdatesRunner.ts). `bun build --compile`
 * bundles every one as an entrypoint of its own (compile.ts, and the smoke
 * check that builds the sidecar the same way).
 */
export const WORKER_ENTRYPOINTS = [
  'src/service/song-sources/updates/songUpdatesWorker.ts',
]

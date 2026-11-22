// The server reads process.env at module load (DEBUG flags, TAURI_MODE): give
// it an empty environment before any server module is evaluated.
const scope = globalThis as unknown as { process?: unknown }
scope.process ??= {
  env: {},
  platform: 'browser',
  versions: {},
  cwd: () => '/',
  on: () => undefined,
  nextTick: (fn: () => void) => queueMicrotask(fn),
}

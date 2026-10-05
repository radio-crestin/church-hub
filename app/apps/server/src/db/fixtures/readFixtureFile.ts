import { readFileSync } from 'node:fs'

/**
 * Reads a fixture embedded with `import path from './x.json' with { type: 'file' }`.
 *
 * The big fixtures (songs, Bibles: ~66 MB) are embedded as files instead of
 * imported as modules: a JSON module is parsed on every start, even though
 * the seed only needs it once, on the first start. As a file it costs nothing
 * until read here. TypeScript types such an import as the JSON value; at
 * runtime it is the file's path (inside the compiled binary, a `$bunfs` path).
 */
export function readFixtureFile<T>(embeddedPath: unknown): T {
  return JSON.parse(readFileSync(embeddedPath as string, 'utf8')) as T
}

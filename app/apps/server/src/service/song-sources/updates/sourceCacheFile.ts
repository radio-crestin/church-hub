import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { getDatabasePath } from '../../../utils/paths'

/** What a check keeps per source: the songs the library lacks, the songs it changed. */
type CacheKind = 'lacking' | 'changed'

/** Next to the database, so another database never reads them. */
const fileOf = (kind: CacheKind, sourceId: string) =>
  join(
    dirname(getDatabasePath()),
    'song-sources',
    kind,
    `${encodeURIComponent(sourceId)}.json`,
  )

export function writeSourceCache(
  kind: CacheKind,
  sourceId: string,
  value: unknown[],
): void {
  const file = fileOf(kind, sourceId)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}

export function readSourceCache<T>(kind: CacheKind, sourceId: string): T[] {
  const file = fileOf(kind, sourceId)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T[]) : []
}

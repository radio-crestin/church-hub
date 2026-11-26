import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

import { loadLibrarySongs } from './loadLibrarySongs'
import { type ResourcePlan, SONG_CHUNK } from './planResources'
import { type ResourceSection, serializeSections } from './resourceBlobFormat'
import type { Database } from 'bun:sqlite'

/** A resource blob written to a temp file, ready to upload. */
export interface ResourceBlob {
  /** SHA-256 (hex) of the canonical contents: the blob's name. */
  hash: string
  /** Bytes as stored (gzipped). */
  sizeBytes: number
  path: string
  /** What it holds, for the encrypted manifest only. */
  label: string
}

const columnsOf = (db: Database, table: string) =>
  (
    db.query(`PRAGMA table_info("${table}")`).all() as {
      name: string
      cid: number
    }[]
  )
    .sort((a, b) => a.cid - b.cid)
    .map((column) => column.name)

function section(
  db: Database,
  table: string,
  where: string,
  ...params: number[]
): ResourceSection {
  const columns = columnsOf(db, table)
  const list = columns.map((c) => `"${c}"`).join(', ')
  const rows = db
    .query(`SELECT ${list} FROM "${table}" WHERE ${where} ORDER BY id`)
    .values(...params) as unknown[][]
  return { table, columns, rows }
}

/**
 * Writes the plan's resource blobs as gzipped temp files: one per Bible
 * translation, one per chunk of library songs' slides. Each is canonical,
 * so unchanged resources keep their hash and are never sent twice.
 */
export async function buildResourceBlobs(
  db: Database,
  plan: ResourcePlan,
  pathFor: (hash: string) => string,
): Promise<ResourceBlob[]> {
  const groups: { label: string; sections: () => ResourceSection[] }[] = []
  for (const id of plan.translationIds) {
    groups.push({
      label: `bible:${id}`,
      sections: () => [
        section(db, 'bible_books', 'translation_id = ?', id),
        section(db, 'bible_verses', 'translation_id = ?', id),
      ],
    })
  }
  const chunks = new Map<number, number[]>()
  for (const id of plan.songIds) {
    const chunk = Math.floor(id / SONG_CHUNK)
    chunks.set(chunk, [...(chunks.get(chunk) ?? []), id])
  }
  loadLibrarySongs(db, plan)
  for (const chunk of [...chunks.keys()].sort((a, b) => a - b)) {
    const from = chunk * SONG_CHUNK
    groups.push({
      label: `song_slides:${from}-${from + SONG_CHUNK - 1}`,
      sections: () => [
        section(
          db,
          'song_slides',
          'song_id IN (SELECT id FROM cloud_library_songs) AND song_id >= ? AND song_id < ?',
          from,
          from + SONG_CHUNK,
        ),
      ],
    })
  }
  const blobs: ResourceBlob[] = []
  for (const group of groups) {
    const contents = serializeSections(group.sections())
    const hash = createHash('sha256').update(contents).digest('hex')
    const gzipped = gzipSync(contents)
    const path = pathFor(hash)
    await writeFile(path, gzipped)
    blobs.push({ hash, sizeBytes: gzipped.length, path, label: group.label })
  }
  return blobs
}

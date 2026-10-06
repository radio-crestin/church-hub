import type { Publication } from './types'
import { getRawDatabase } from '../../../db'

interface PublicationRow {
  id: number
  category_id: number
  category_name: string
  folder: string
  published_manifest: string | null
  last_synced_at: number | null
  last_error: string | null
}

/** Every published category, by category name. */
export function listPublications(): Publication[] {
  return getRawDatabase()
    .query<PublicationRow, []>(
      `SELECT p.id, p.category_id, c.name AS category_name, p.folder,
              p.published_manifest, p.last_synced_at, p.last_error
         FROM song_source_publications p
         JOIN song_categories c ON c.id = p.category_id
        ORDER BY c.name`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      folder: row.folder,
      publishedManifest: row.published_manifest
        ? JSON.parse(row.published_manifest)
        : null,
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
    }))
}

export function getPublication(id: number): Publication | null {
  return listPublications().find((p) => p.id === id) ?? null
}

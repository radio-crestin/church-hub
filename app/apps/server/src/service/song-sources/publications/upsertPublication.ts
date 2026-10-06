import { getRawDatabase } from '../../../db'

/** "Pe Drumul Credinței" → "pe-drumul-credintei" */
function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'songs'
  )
}

/**
 * Publishes a category (idempotent): its folder is named after the
 * category, made unique with the category id when the name is taken.
 * Returns the publication id.
 */
export function upsertPublication(categoryId: number): number {
  const db = getRawDatabase()
  const existing = db
    .query<{ id: number }, [number]>(
      'SELECT id FROM song_source_publications WHERE category_id = ?',
    )
    .get(categoryId)
  if (existing) return existing.id

  const category = db
    .query<{ name: string }, [number]>(
      'SELECT name FROM song_categories WHERE id = ?',
    )
    .get(categoryId)
  if (!category) throw new Error(`Category ${categoryId} not found`)

  const slug = slugify(category.name)
  const taken = db
    .query<{ id: number }, [string]>(
      'SELECT id FROM song_source_publications WHERE folder = ?',
    )
    .get(slug)
  const folder = taken ? `${slug}-${categoryId}` : slug

  const row = db
    .query<{ id: number }, [number, string]>(
      `INSERT INTO song_source_publications (category_id, folder)
       VALUES (?, ?) RETURNING id`,
    )
    .get(categoryId, folder)
  if (!row) throw new Error('Could not save the publication')
  return row.id
}

/** Records the outcome of a sync: the manifest now online, or the error. */
export function recordPublicationSync(
  id: number,
  outcome: { manifest: string } | { error: string },
): void {
  const db = getRawDatabase()
  if ('manifest' in outcome) {
    db.query(
      `UPDATE song_source_publications
          SET published_manifest = ?, last_synced_at = unixepoch(),
              last_error = NULL
        WHERE id = ?`,
    ).run(outcome.manifest, id)
  } else {
    db.query(
      'UPDATE song_source_publications SET last_error = ? WHERE id = ?',
    ).run(outcome.error, id)
  }
}

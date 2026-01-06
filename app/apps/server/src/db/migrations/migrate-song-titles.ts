import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrate-song-titles:${level}] ${message}`)
}

const MIGRATION_KEY = 'migrate_song_titles_ascii_v1'

/**
 * Transliterate Romanian diacritics to ASCII equivalents
 */
function transliterateDiacritics(text: string): string {
  const diacriticMap: Record<string, string> = {
    ă: 'a',
    Ă: 'A',
    â: 'a',
    Â: 'A',
    î: 'i',
    Î: 'I',
    ș: 's',
    Ș: 'S',
    ş: 's',
    Ş: 'S',
    ț: 't',
    Ț: 'T',
    ţ: 't',
    Ţ: 'T',
  }

  return text
    .split('')
    .map((char) => diacriticMap[char] ?? char)
    .join('')
}

/**
 * Extract title from first verse content using ASCII-only extraction
 * Keeps only a-zA-Z, spaces, and hyphens
 */
function extractTitleFromContent(content: string): string | null {
  // Extract text from first <p> tag
  const match = content.match(/<p[^>]*>(.*?)<\/p>/i)
  if (!match) return null

  let text = match[1]

  // Remove HTML entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, '')

  // Transliterate Romanian diacritics to ASCII
  text = transliterateDiacritics(text)

  // Remove leading special characters and numbers (e.g., "1.", "050 -", "/:", etc.)
  text = text.replace(/^[\d/:.*•►\s-]+/u, '')

  // Keep only ASCII letters, spaces, and hyphens
  text = text.replace(/[^a-zA-Z\s-]/g, '')

  // Normalize multiple spaces/hyphens to single
  text = text.replace(/\s+/g, ' ').replace(/-+/g, '-')

  // Remove leading/trailing hyphens and spaces
  text = text.replace(/^[-\s]+|[-\s]+$/g, '').trim()

  return text || null
}

/**
 * Migrate song titles for BCEV Baicoi and Laudele Domnului categories
 * Re-generates titles from first verse content using ASCII-only extraction
 */
export function migrateSongTitles(db: Database): void {
  // Check if migration already applied
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Song titles migration already applied, skipping')
    return
  }

  log(
    'info',
    'Starting song titles migration for BCEV Baicoi and Laudele Domnului...',
  )

  // Get category IDs
  const categories = db
    .query<{ id: number; name: string }, []>(
      "SELECT id, name FROM song_categories WHERE name IN ('BCEV Baicoi', 'Laudele Domnului')",
    )
    .all()

  if (categories.length === 0) {
    log('warning', 'No target categories found, skipping migration')
    return
  }

  const categoryIds = categories.map((c) => c.id)
  log(
    'info',
    `Found categories: ${categories.map((c) => `${c.name} (${c.id})`).join(', ')}`,
  )

  // Get all songs in target categories with their first slide
  const songs = db
    .query<{ id: number; title: string; content: string }, [number, number]>(
      `SELECT s.id, s.title, ss.content
       FROM songs s
       JOIN song_slides ss ON s.id = ss.song_id
       WHERE s.category_id IN (?, ?)
       AND ss.sort_order = (
         SELECT MIN(sort_order) FROM song_slides WHERE song_id = s.id
       )`,
    )
    .all(categoryIds[0], categoryIds[1])

  log('info', `Processing ${songs.length} songs...`)

  let updatedCount = 0
  let skippedCount = 0
  const conflicts: Array<{
    id: number
    oldTitle: string
    newTitle: string
    existingId: number
  }> = []

  for (const song of songs) {
    const newTitle = extractTitleFromContent(song.content)

    if (!newTitle) {
      log('debug', `Could not extract title for song ${song.id}: ${song.title}`)
      skippedCount++
      continue
    }

    if (newTitle === song.title) {
      log('debug', `Title unchanged for song ${song.id}: ${song.title}`)
      skippedCount++
      continue
    }

    // Check for title conflicts
    const existing = db
      .query<{ id: number }, [string, number]>(
        'SELECT id FROM songs WHERE title = ? AND id != ?',
      )
      .get(newTitle, song.id)

    if (existing) {
      conflicts.push({
        id: song.id,
        oldTitle: song.title,
        newTitle,
        existingId: existing.id,
      })
      log(
        'warning',
        `Title conflict: "${song.title}" -> "${newTitle}" (already exists as song ${existing.id})`,
      )
      continue
    }

    // Update the title
    db.run(
      'UPDATE songs SET title = ?, updated_at = unixepoch() WHERE id = ?',
      [newTitle, song.id],
    )

    log('debug', `Updated song ${song.id}: "${song.title}" -> "${newTitle}"`)
    updatedCount++
  }

  // Mark migration as complete
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [
      MIGRATION_KEY,
      JSON.stringify({
        updatedCount,
        skippedCount,
        conflicts: conflicts.length,
      }),
    ],
  )

  log(
    'info',
    `Migration complete: ${updatedCount} updated, ${skippedCount} skipped, ${conflicts.length} conflicts`,
  )

  if (conflicts.length > 0) {
    log('warning', 'Conflicts that need manual resolution:')
    for (const conflict of conflicts) {
      log(
        'warning',
        `  Song ${conflict.id}: "${conflict.oldTitle}" -> "${conflict.newTitle}" (conflicts with song ${conflict.existingId})`,
      )
    }
  }
}

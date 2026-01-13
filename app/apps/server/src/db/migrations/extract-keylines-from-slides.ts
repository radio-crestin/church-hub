import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[extract-keylines:${level}] ${message}`)
}

const MIGRATION_KEY = 'extract_keylines_from_slides_v1'

// Musical key patterns - solfège (Romanian/Italian) notation
// Matches: Mi M, Do M, Sol, Fa(Mi), Re(Mi M), Sol (Fa M sau Mi), La M, Mi m, etc.
const KEY_REGEX =
  /^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?\s*(Major|Minor|Maj|Min|M|m)?(\s*\(.*\))?(\s+sau\s+.*)?$/i

/**
 * Extract text from last <p> tag in HTML content
 */
function extractLastParagraph(html: string): string | null {
  const paragraphs = html.match(/<p>([^<]*)<\/p>/gi)
  if (!paragraphs || paragraphs.length === 0) return null
  const lastP = paragraphs[paragraphs.length - 1]
  return lastP.replace(/<\/?p>/gi, '').trim()
}

/**
 * Remove last <p> tag from HTML content
 */
function removeLastParagraph(html: string): string {
  const paragraphs = html.match(/<p>([^<]*)<\/p>/gi)
  if (!paragraphs || paragraphs.length === 0) return html

  const lastP = paragraphs[paragraphs.length - 1]
  const lastIndex = html.lastIndexOf(lastP)

  if (lastIndex === -1) return html

  return html.slice(0, lastIndex) + html.slice(lastIndex + lastP.length)
}

interface SongSlide {
  id: number
  song_id: number
  content: string
  sort_order: number
}

interface Song {
  id: number
  title: string
  key_line: string | null
}

/**
 * Extract keylines from the last line of first slides and move them to the keyLine field
 */
export function extractKeylinesFromSlides(db: Database): void {
  // Check if migration already applied
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Extract keylines migration already applied, skipping')
    return
  }

  log('info', 'Extracting keylines from first slide last paragraphs...')

  db.run('BEGIN TRANSACTION')

  try {
    // Get all songs
    const songs = db
      .query<Song, []>('SELECT id, title, key_line FROM songs')
      .all()

    let updatedCount = 0
    let skippedExisting = 0
    let skippedNoMatch = 0

    for (const song of songs) {
      // Get first slide (lowest sort_order)
      const firstSlide = db
        .query<SongSlide, [number]>(
          'SELECT id, song_id, content, sort_order FROM song_slides WHERE song_id = ? ORDER BY sort_order ASC LIMIT 1',
        )
        .get(song.id)

      if (!firstSlide?.content) {
        skippedNoMatch++
        continue
      }

      const lastParagraph = extractLastParagraph(firstSlide.content)
      if (!lastParagraph) {
        skippedNoMatch++
        continue
      }

      // Check if last paragraph matches key pattern
      if (!KEY_REGEX.test(lastParagraph)) {
        skippedNoMatch++
        continue
      }

      // Skip if song already has a keyLine set
      if (song.key_line) {
        skippedExisting++
        continue
      }

      // Update song's keyLine
      db.run(
        'UPDATE songs SET key_line = ?, updated_at = unixepoch() WHERE id = ?',
        [lastParagraph, song.id],
      )

      // Remove last paragraph from slide content
      const newContent = removeLastParagraph(firstSlide.content)
      db.run(
        'UPDATE song_slides SET content = ?, updated_at = unixepoch() WHERE id = ?',
        [newContent, firstSlide.id],
      )

      updatedCount++
      log(
        'debug',
        `Updated song "${song.title}" with keyLine: ${lastParagraph}`,
      )
    }

    db.run('COMMIT')

    // Mark migration as complete
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [
        MIGRATION_KEY,
        JSON.stringify({
          success: true,
          updatedCount,
          skippedExisting,
          skippedNoMatch,
        }),
      ],
    )

    log(
      'info',
      `Keyline extraction complete: ${updatedCount} updated, ${skippedExisting} skipped (existing keyLine), ${skippedNoMatch} skipped (no match)`,
    )
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed to extract keylines: ${error}`)
    throw error
  }
}

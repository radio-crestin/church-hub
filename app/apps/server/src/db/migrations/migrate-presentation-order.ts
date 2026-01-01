import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrate-presentation-order:${level}] ${message}`)
}

interface SongRow {
  id: number
  title: string
  presentation_order: string | null
}

interface SlideRow {
  id: number
  song_id: number
  content: string
  label: string | null
  sort_order: number
}

/**
 * Detects if a slide is a chorus based on its content
 * Choruses in Romanian typically start with "Refren:" or "Cor:"
 */
function isChorusContent(content: string): boolean {
  // Normalize content - remove HTML tags for easier matching
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()

  // Check for common chorus indicators in Romanian
  return (
    plainText.startsWith('refren:') ||
    plainText.startsWith('refren') ||
    plainText.startsWith('cor:') ||
    plainText.startsWith('cor ')
  )
}

/**
 * Normalizes content for comparison (removes HTML, whitespace, punctuation)
 */
function normalizeContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase()
}

/**
 * Migrates existing songs to have proper presentation_order and slide labels.
 * Only processes songs where presentation_order is NULL or empty.
 *
 * This migration:
 * 1. Detects choruses based on content (starts with "Refren:" or "Cor:")
 * 2. Assigns labels (V1, V2, C1, C2, etc.) to slides without labels
 * 3. Generates presentation_order string from the labeled slides
 */
export function migratePresentationOrder(db: Database): void {
  // Check if migration already ran by looking for a marker
  // We use the app_settings table to track this
  // v2: Fixed to generate V1 C1 V2 C1... pattern for songs with existing labels
  const migrationKey = 'migration_presentation_order_v2'
  const existing = db
    .query('SELECT value FROM app_settings WHERE key = ?')
    .get(migrationKey) as { value: string } | null

  if (existing) {
    log('debug', 'Presentation order migration already completed, skipping')
    return
  }

  log('info', 'Starting presentation order migration...')

  // Get all songs without presentation_order
  const songsToMigrate = db
    .query<SongRow, []>(
      `SELECT id, title, presentation_order FROM songs
       WHERE presentation_order IS NULL OR presentation_order = ''`,
    )
    .all()

  if (songsToMigrate.length === 0) {
    log('info', 'No songs need migration')
    markMigrationComplete(db, migrationKey)
    return
  }

  log('info', `Found ${songsToMigrate.length} songs to migrate`)

  let migratedCount = 0

  for (const song of songsToMigrate) {
    // Get slides for this song
    const slides = db
      .query<SlideRow, [number]>(
        `SELECT id, song_id, content, label, sort_order FROM song_slides
         WHERE song_id = ? ORDER BY sort_order`,
      )
      .all(song.id)

    if (slides.length === 0) {
      log('debug', `Song ${song.title} has no slides, skipping`)
      continue
    }

    // Assign labels and generate presentation order
    const { labels, presentationOrder } = processSlides(slides)

    // Update slides with new labels
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      const newLabel = labels[i]

      if (slide.label !== newLabel) {
        db.run('UPDATE song_slides SET label = ? WHERE id = ?', [
          newLabel,
          slide.id,
        ])
      }
    }

    // Update song with presentation order
    db.run('UPDATE songs SET presentation_order = ? WHERE id = ?', [
      presentationOrder,
      song.id,
    ])

    log('debug', `Migrated song: ${song.title} -> ${presentationOrder}`)
    migratedCount++
  }

  markMigrationComplete(db, migrationKey)
  log('info', `Migration complete: ${migratedCount} songs migrated`)
}

/**
 * Process slides to assign labels and generate presentation order
 * For slides with existing labels, generates V1 C1 V2 C1... pattern
 * For slides without labels, detects content and outputs in slide order
 */
function processSlides(slides: SlideRow[]): {
  labels: string[]
  presentationOrder: string
} {
  const labels: string[] = []

  // Check if slides already have labels
  const hasExistingLabels = slides.some((s) => s.label)

  // Track unique content for choruses to detect when C1 becomes C2
  const chorusContentMap = new Map<string, string>() // normalizedContent -> label (C1, C2, etc.)
  let chorusCounter = 1
  let verseCounter = 1

  for (const slide of slides) {
    let label = slide.label

    if (!label) {
      const isChorus = isChorusContent(slide.content)

      if (isChorus) {
        const normalizedContent = normalizeContent(slide.content)

        // Check if we've seen this chorus content before
        if (chorusContentMap.has(normalizedContent)) {
          label = chorusContentMap.get(normalizedContent)!
        } else {
          // New unique chorus
          label = `C${chorusCounter}`
          chorusContentMap.set(normalizedContent, label)
          chorusCounter++
        }
      } else {
        // It's a verse
        label = `V${verseCounter}`
        verseCounter++
      }
    }

    labels.push(label!)
  }

  // Generate presentation order
  let presentationOrder: string

  if (hasExistingLabels) {
    // For slides with existing labels, generate V1 C1 V2 C1... pattern
    presentationOrder = generatePresentationOrderFromLabels(labels)
  } else {
    // For slides without labels (PPTX), output in slide order
    presentationOrder = labels.join(' ')
  }

  return { labels, presentationOrder }
}

/**
 * Generates presentation order with chorus after each verse pattern
 * V1 C1 V2 C1 V3 C1... with C2 replacing C1 when encountered
 */
function generatePresentationOrderFromLabels(labels: string[]): string {
  if (labels.length === 0) return ''

  // Find all unique verse labels and chorus labels
  const verses: string[] = []
  const choruses: string[] = []

  for (const label of labels) {
    if (label.startsWith('V') && !verses.includes(label)) {
      verses.push(label)
    } else if (label.startsWith('C') && !choruses.includes(label)) {
      choruses.push(label)
    }
  }

  // If no choruses, return all unique labels in order
  if (choruses.length === 0) {
    const uniqueLabels: string[] = []
    for (const label of labels) {
      if (!uniqueLabels.includes(label)) {
        uniqueLabels.push(label)
      }
    }
    return uniqueLabels.join(' ')
  }

  // Sort verses numerically (V1, V2, V3...)
  verses.sort((a, b) => {
    const numA = parseInt(a.substring(1)) || 0
    const numB = parseInt(b.substring(1)) || 0
    return numA - numB
  })

  // Sort choruses numerically (C1, C2...)
  choruses.sort((a, b) => {
    const numA = parseInt(a.substring(1)) || 0
    const numB = parseInt(b.substring(1)) || 0
    return numA - numB
  })

  // Build presentation order: V1 C1 V2 C1 V3 C1... with C2 replacing C1 when encountered
  const result: string[] = []
  let currentChorusIndex = 0

  for (let i = 0; i < verses.length; i++) {
    result.push(verses[i])

    // Add chorus after each verse
    if (choruses.length > 0) {
      const chorusToUse =
        choruses[Math.min(currentChorusIndex, choruses.length - 1)]
      result.push(chorusToUse)

      // If there are multiple choruses, advance after half the verses
      if (choruses.length > 1 && i === Math.floor(verses.length / 2) - 1) {
        currentChorusIndex++
      }
    }
  }

  return result.join(' ')
}

/**
 * Marks the migration as complete
 */
function markMigrationComplete(db: Database, key: string): void {
  db.run(
    `INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at)
     VALUES (?, ?, unixepoch(), unixepoch())`,
    [key, JSON.stringify({ completedAt: new Date().toISOString() })],
  )
}

import type { Database } from 'bun:sqlite'
import {
  type LegacyBiblePassageVerse,
  resolveLegacyBiblePassage,
} from '../../service/schedules/resolveLegacyBiblePassage'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[merge-bible-passages:${level}] ${message}`)
}

const MIGRATION_KEY = 'merge_bible_passages_into_versete_tineri_v1'

interface PassageItemRow {
  id: number
  schedule_id: number
  bible_passage_reference: string | null
  bible_passage_translation: string | null
  sort_order: number
}

interface SkippedPassage {
  itemId: number
  scheduleId: number
  reference: string | null
  reason: string
}

export interface MergeBiblePassagesResult {
  converted: number
  skipped: SkippedPassage[]
}

/**
 * Merges the legacy `bible_passage` schedule items into the surviving
 * "Versete Biblice" shape: one `slide` item with `slide_type = 'versete_tineri'`
 * holding a single entry with the whole passage as one block of text and no
 * person name.
 *
 * Conversion is driven by the stored verse ids (they point straight at the
 * local Bible), falling back to re-parsing the display reference. An item that
 * resolves to neither is LEFT EXACTLY AS IT IS and reported — a program with a
 * mangled passage would be far worse than one that still carries a legacy item,
 * and the read paths still understand the old shape.
 *
 * Idempotent: converted items are no longer `bible_passage`, so a second run
 * finds nothing. The completion flag is only written once every item converted,
 * so a passage skipped because its translation was missing gets another chance
 * on a later boot.
 */
export function mergeBiblePassagesIntoVerseteTineri(
  db: Database,
): MergeBiblePassagesResult {
  const flag = db
    .query<{ value: string }, [string]>(
      'SELECT value FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)

  if (flag) {
    try {
      if ((JSON.parse(flag.value) as { done?: boolean }).done === true) {
        log('debug', 'Migration already applied, skipping')
        return { converted: 0, skipped: [] }
      }
    } catch {
      // A malformed flag simply means "run again".
    }
  }

  const items = db
    .query<PassageItemRow, []>(
      `SELECT id, schedule_id, bible_passage_reference, bible_passage_translation, sort_order
       FROM schedule_items WHERE item_type = 'bible_passage'
       ORDER BY schedule_id, sort_order, id`,
    )
    .all()

  if (items.length === 0) {
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [
        MIGRATION_KEY,
        JSON.stringify({ done: true, converted: 0, skipped: [] }),
      ],
    )
    log('debug', 'No bible_passage items to merge')
    return { converted: 0, skipped: [] }
  }

  log('info', `Merging ${items.length} bible_passage item(s)...`)

  const selectVerses = db.query<LegacyBiblePassageVerse, [number]>(
    `SELECT verse_id AS verseId, reference, text, sort_order AS sortOrder
     FROM schedule_bible_passage_verses
     WHERE schedule_item_id = ?
     ORDER BY sort_order, id`,
  )
  const insertEntry = db.query(
    `INSERT INTO schedule_versete_tineri_entries (
       schedule_item_id, person_name, translation_id, book_code, book_name,
       reference, text, start_chapter, start_verse, end_chapter, end_verse, sort_order
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
  const convertItem = db.query(
    `UPDATE schedule_items
     SET item_type = 'slide', slide_type = 'versete_tineri', slide_content = NULL,
         bible_passage_reference = NULL, bible_passage_translation = NULL,
         updated_at = unixepoch()
     WHERE id = ?`,
  )
  const deleteVerses = db.query(
    'DELETE FROM schedule_bible_passage_verses WHERE schedule_item_id = ?',
  )
  const hasEntry = db.query<{ count: number }, [number]>(
    'SELECT COUNT(*) as count FROM schedule_versete_tineri_entries WHERE schedule_item_id = ?',
  )

  const skipped: SkippedPassage[] = []
  let converted = 0

  db.run('BEGIN TRANSACTION')
  try {
    for (const item of items) {
      // A half-converted item (entry written, item_type not yet flipped) would
      // otherwise get a second entry on the retry.
      if ((hasEntry.get(item.id)?.count ?? 0) > 0) {
        convertItem.run(item.id)
        deleteVerses.run(item.id)
        converted++
        continue
      }

      const resolution = resolveLegacyBiblePassage(db, {
        reference: item.bible_passage_reference,
        translationAbbreviation: item.bible_passage_translation,
        verses: selectVerses.all(item.id),
      })

      if (!resolution.ok) {
        log(
          'warning',
          `Leaving schedule item ${item.id} (schedule ${item.schedule_id}, "${item.bible_passage_reference ?? ''}") as a legacy bible_passage: ${resolution.reason}`,
        )
        skipped.push({
          itemId: item.id,
          scheduleId: item.schedule_id,
          reference: item.bible_passage_reference,
          reason: resolution.reason,
        })
        continue
      }

      const entry = resolution.entry
      insertEntry.run(
        item.id,
        entry.personName,
        entry.translationId,
        entry.bookCode,
        entry.bookName,
        entry.reference,
        entry.text,
        entry.startChapter,
        entry.startVerse,
        entry.endChapter,
        entry.endVerse,
      )
      convertItem.run(item.id)
      deleteVerses.run(item.id)
      converted++

      log(
        'debug',
        `Converted schedule item ${item.id} via ${resolution.source}: ${entry.reference}`,
      )
    }

    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [
        MIGRATION_KEY,
        JSON.stringify({ done: skipped.length === 0, converted, skipped }),
      ],
    )

    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed to merge bible_passage items: ${error}`)
    throw error
  }

  log(
    'info',
    `Merged ${converted} bible_passage item(s), ${skipped.length} left untouched`,
  )

  return { converted, skipped }
}

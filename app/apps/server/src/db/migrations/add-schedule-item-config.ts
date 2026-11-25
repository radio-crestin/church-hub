import type { Database } from 'bun:sqlite'

/**
 * Adds `schedule_items.item_config`: the settings of the music, video and
 * verses items (service/schedule-items). Idempotent: safe on every boot.
 */
export function addScheduleItemConfig(db: Database): void {
  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(schedule_items)')
    .all()
  if (columns.some((col) => col.name === 'item_config')) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log('[add-schedule-item-config:info] Adding "item_config" column')
  db.run('ALTER TABLE schedule_items ADD COLUMN item_config TEXT')
}

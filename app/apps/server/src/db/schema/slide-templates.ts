import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { screens } from './presentation'

/**
 * A slide template: how every kind of slide looks (CH-184). Screens,
 * presentations and their items point to one; the displays, the previews and
 * the editor all draw it the same way. Created by add-slide-templates.
 */
export const slideTemplates = sqliteTable(
  'slide_templates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** Set on the designs that ship with the app: read-only, refreshed on start. */
    bundledKey: text('bundled_key'),
    /**
     * The presentation this theme belongs to: its own copy, changed from the
     * presentation and deleted with it. NULL: a shared theme.
     */
    scheduleId: integer('schedule_id'),
    /** The design canvas in px; positions and font sizes are on it. */
    width: integer('width').notNull().default(1920),
    height: integer('height').notNull().default(1080),
    /** JSON: Record<ContentType, layout config>, one layout per slide kind. */
    layouts: text('layouts').notNull().default('{}'),
    /** JSON: ScreenGlobalSettings (the clock's place and look, fallback background). */
    globalSettings: text('global_settings').notNull().default('{}'),
    /** JSON: NextSlideSectionConfig (the "next slide" strip). */
    nextSlide: text('next_slide').notNull().default('{}'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('idx_slide_templates_bundled_key').on(table.bundledKey),
  ],
)

/** While an OBS scene is live, a screen draws with this template. */
export const screenSceneTemplates = sqliteTable(
  'screen_scene_templates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    screenId: integer('screen_id')
      .notNull()
      .references(() => screens.id, { onDelete: 'cascade' }),
    obsSceneName: text('obs_scene_name').notNull(),
    templateId: integer('template_id')
      .notNull()
      .references(() => slideTemplates.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_screen_scene_templates_unique').on(
      table.screenId,
      table.obsSceneName,
    ),
    index('idx_screen_scene_templates_template_id').on(table.templateId),
  ],
)

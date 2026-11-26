import type { Database } from 'bun:sqlite'
import { getDefaultContentConfig } from '../../service/presentation/default-design/getDefaultContentConfig'
import { getDefaultGlobalSettings } from '../../service/presentation/default-design/getDefaultGlobalSettings'
import { getDefaultNextSlideConfig } from '../../service/presentation/default-design/getDefaultNextSlideConfig'
import { getMissingContentConfig } from '../../service/presentation/getMissingContentConfig'
import { readLegacyClockFlag } from '../../service/presentation/readLegacyClockFlag'
import type { ContentType, ScreenType } from '../../service/presentation/types'
import { contentTypes } from '../schema'

const MIGRATION_KEY = 'move_screen_layouts_into_templates'
const OLD_TABLES = [
  'screen_content_configs',
  'screen_next_slide_configs',
  'screen_scene_overrides',
]
const OLD_SCREEN_COLUMNS = ['width', 'height', 'global_settings']

function log(level: 'info' | 'warning', message: string) {
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[move-screen-layouts-into-templates:${level}] ${message}`)
}

type Layout = Record<string, unknown>

interface OldScreen {
  id: number
  name: string
  type: ScreenType
  width: number
  height: number
  global_settings: string
  template_id: number | null
}

function parse(json: string | undefined): Layout | undefined {
  if (json === undefined) return undefined
  try {
    return readLegacyClockFlag(JSON.parse(json) as Layout)
  } catch {
    log('warning', `Unreadable layout kept as the factory design: ${json}`)
    return undefined
  }
}

function tableExists(db: Database, name: string): boolean {
  return !!db
    .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name)
}

/** Slide kinds a screen that never saved them draws from its `song` layout. */
const FOLLOWS_SONG: ContentType[] = ['song_first_slide', 'song_last_slide']

/**
 * A screen's layouts as it drew them. `own` leaves out the first/last song
 * slide layouts the screen never saved, so they keep following its song
 * layout; `drawn` has every slide kind as it looked (for its OBS scenes).
 */
function screenLayouts(db: Database, screen: OldScreen) {
  const stored = new Map(
    db
      .query<{ content_type: ContentType; config: string }, [number]>(
        'SELECT content_type, config FROM screen_content_configs WHERE screen_id = ?',
      )
      .all(screen.id)
      .map((row) => [row.content_type, parse(row.config)]),
  )
  const saved = (type: ContentType) => {
    const layout = stored.get(type)
    return layout ? { ...getDefaultContentConfig(type), ...layout } : undefined
  }
  const song = saved('song')
  const own = {} as Record<ContentType, Layout>
  const drawn = {} as Record<ContentType, Layout>
  for (const type of contentTypes) {
    const layout = saved(type)
    drawn[type] = layout ?? getMissingContentConfig(type, screen.type, song)
    if (layout || !FOLLOWS_SONG.includes(type)) own[type] = drawn[type]
  }
  return { own, drawn }
}

function insertTemplate(
  db: Database,
  name: string,
  screen: OldScreen,
  layouts: Record<ContentType, Layout>,
  nextSlide: Layout,
): number {
  let globalSettings: Layout = {}
  try {
    globalSettings = JSON.parse(screen.global_settings) as Layout
  } catch {
    log('warning', `Screen ${screen.id}: unreadable global settings`)
  }
  const row = db
    .query<{ id: number }, (string | number)[]>(
      `INSERT INTO slide_templates (name, width, height, layouts, global_settings, next_slide)
        VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      name,
      screen.width,
      screen.height,
      JSON.stringify(layouts),
      JSON.stringify({ ...getDefaultGlobalSettings(), ...globalSettings }),
      JSON.stringify(nextSlide),
    )
  return (row as { id: number }).id
}

function moveScreen(db: Database, screen: OldScreen): void {
  const { own, drawn } = screenLayouts(db, screen)
  const nextSlideRow = db
    .query<{ config: string }, [number]>(
      'SELECT config FROM screen_next_slide_configs WHERE screen_id = ?',
    )
    .get(screen.id)
  const nextSlide = parse(nextSlideRow?.config) ?? {
    ...getDefaultNextSlideConfig(),
    enabled: false,
  }
  const templateId = insertTemplate(db, screen.name, screen, own, nextSlide)
  db.run(
    'UPDATE screens SET template_id = ?, follows_presentation = ? WHERE id = ?',
    [
      templateId,
      screen.type === 'primary' || screen.type === 'kiosk' ? 1 : 0,
      screen.id,
    ],
  )

  // Each OBS scene's layouts replaced whole slide kinds of the screen's: the
  // scene's template is the screen's with those kinds swapped in.
  const overrides = db
    .query<
      { obs_scene_name: string; content_type: ContentType; config: string },
      [number]
    >(
      'SELECT obs_scene_name, content_type, config FROM screen_scene_overrides WHERE screen_id = ?',
    )
    .all(screen.id)
  const scenes = new Map<string, Record<ContentType, Layout>>()
  for (const row of overrides) {
    const sceneLayouts = scenes.get(row.obs_scene_name) ?? { ...drawn }
    sceneLayouts[row.content_type] =
      parse(row.config) ?? drawn[row.content_type]
    scenes.set(row.obs_scene_name, sceneLayouts)
  }
  for (const [scene, sceneLayouts] of scenes) {
    const sceneTemplateId = insertTemplate(
      db,
      `${screen.name} · ${scene}`,
      screen,
      sceneLayouts,
      nextSlide,
    )
    db.run(
      'INSERT INTO screen_scene_templates (screen_id, obs_scene_name, template_id) VALUES (?, ?, ?)',
      [screen.id, scene, sceneTemplateId],
    )
  }
  log(
    'info',
    `Screen ${screen.id} (${screen.name}) → template ${templateId}, ${scenes.size} OBS scene template(s)`,
  )
}

/**
 * CH-184: every screen kept its own layouts (one per slide kind, plus whole
 * slide kinds swapped per OBS scene). Each screen's become a template of its
 * own, named after it, and each OBS scene's a template mapped to that scene,
 * so every display draws exactly as before. The per-screen tables and columns
 * are then dropped. One transaction; runs once.
 */
export function moveScreenLayoutsIntoTemplates(db: Database): void {
  const done = db
    .query('SELECT 1 FROM app_settings WHERE key = ?')
    .get(MIGRATION_KEY)
  if (done) return

  db.transaction(() => {
    if (tableExists(db, 'screen_content_configs')) {
      const screens = db
        .query<OldScreen, []>(
          'SELECT id, name, type, width, height, global_settings, template_id FROM screens',
        )
        .all()
      for (const screen of screens) {
        if (screen.template_id === null) moveScreen(db, screen)
      }
    }
    for (const table of OLD_TABLES) db.run(`DROP TABLE IF EXISTS ${table}`)
    const columns = db
      .query<{ name: string }, []>('PRAGMA table_info(screens)')
      .all()
      .map((column) => column.name)
    for (const column of OLD_SCREEN_COLUMNS) {
      if (columns.includes(column)) {
        db.run(`ALTER TABLE screens DROP COLUMN ${column}`)
      }
    }
    db.run(
      'INSERT INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [MIGRATION_KEY, JSON.stringify({ success: true })],
    )
  })()
}

import type { Database } from 'bun:sqlite'
import {
  BUNDLED_KEY_FOR_SCREEN,
  BUNDLED_TEMPLATES,
} from '../../service/slide-templates/bundledTemplates'
import type { TemplateDesign } from '../../service/slide-templates/types'
import defaultScreens from '../fixtures/default-screens.json'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-screens:${level}] ${message}`)
}

type ScreenType = 'primary' | 'stage' | 'livestream' | 'kiosk'

interface ScreenFixture {
  name: string
  type: ScreenType
  isActive: boolean
  openMode: string
  isFullscreen: boolean
  closeOnEscape?: boolean
  alwaysOnTop?: boolean
  isPreviewScreen?: boolean
  openOnStartup?: boolean
  sortOrder: number
  /** Its own design: left out, the bundled design of its type applies. */
  design?: TemplateDesign
}

function bundledDesign(type: ScreenType): TemplateDesign {
  const key = BUNDLED_KEY_FOR_SCREEN[type]
  const bundled = BUNDLED_TEMPLATES.find((template) => template.key === key)
  if (!bundled) throw new Error(`No bundled template "${key}"`)
  return bundled.design()
}

/** The screen's own template, named after it: its design to change. */
function insertTemplate(db: Database, screen: ScreenFixture): number {
  const design = screen.design ?? bundledDesign(screen.type)
  const row = db
    .query<{ id: number }, (string | number)[]>(
      `INSERT INTO slide_templates (name, width, height, layouts, global_settings, next_slide)
        VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      screen.name,
      design.width,
      design.height,
      JSON.stringify(design.layouts),
      JSON.stringify(design.globalSettings),
      JSON.stringify(design.nextSlide),
    )
  return (row as { id: number }).id
}

/**
 * Seeds the default screens (default-screens.json) on an install without
 * screens, each with a template of its own: the fixture's design when it has
 * one (`bun run fixtures` writes them), else the bundled one of its type.
 * @throws Error if seeding fails
 */
export function seedDefaultScreens(db: Database): void {
  const existing = db
    .query<{ count: number }, []>('SELECT COUNT(*) as count FROM screens')
    .get()
  if (existing && existing.count > 0) {
    log('debug', `Screens already exist (${existing.count}), skipping seed`)
    return
  }

  log('info', 'Seeding default screens from fixtures...')
  const screens = defaultScreens as ScreenFixture[]
  for (const screen of screens) {
    db.run(
      `INSERT INTO screens
          (name, type, is_active, open_mode, is_fullscreen, always_on_top, close_on_escape,
           is_preview_screen, open_on_startup, template_id, follows_presentation, sort_order,
           created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
      [
        screen.name,
        screen.type,
        screen.isActive ? 1 : 0,
        screen.openMode,
        // A projection screen fills its display unless the fixture opts out.
        screen.isFullscreen === false ? 0 : 1,
        // Above other windows, so a web page can't cover the projection.
        screen.alwaysOnTop === false ? 0 : 1,
        screen.closeOnEscape ? 1 : 0,
        screen.isPreviewScreen ? 1 : 0,
        screen.openOnStartup === false ? 0 : 1,
        insertTemplate(db, screen),
        screen.type === 'primary' || screen.type === 'kiosk' ? 1 : 0,
        screen.sortOrder,
      ],
    )
    log('debug', `Seeded screen: ${screen.name} (${screen.type})`)
  }
  log('info', `Seeded ${screens.length} default screens from fixtures`)
}

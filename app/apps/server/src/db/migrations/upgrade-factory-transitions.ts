import type { Database } from 'bun:sqlite'
import { factoryTransitions } from '../../service/presentation/default-design/factoryTransitions'
import type { ScreenType } from '../../service/presentation/types'

const MIGRATION_KEY = 'factory_transitions_v3'
/** The quick fades of T-158 (v0.1.105 on). */
const QUICK_MIGRATION_KEY = 'factory_transitions_v2'
/** The first version, which moved every earlier factory design to the calm fades. */
const CALM_MIGRATION_KEY = 'calm_factory_transitions_v1'
const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[upgrade-factory-transitions:${level}] ${message}`)
}

type Transition = { type?: string; duration?: number } | undefined
type TransitionKey = keyof ReturnType<typeof factoryTransitions>
type Signatures = Record<TransitionKey, string[]>

/** The slow calm fades of v0.1.104 and before (T-112). */
const CALM: Signatures = {
  animationIn: ['fade/500'],
  animationOut: ['fade/400'],
  slideTransitionIn: ['fade/400'],
  slideTransitionOut: ['fade/300'],
}

/**
 * The quick fades of T-158: 300 / 250 / 300 / 300 ms on the main projection
 * and kiosk, 250 / 200 / 250 / 250 ms on the livestream overlay.
 */
const QUICK: Signatures = {
  animationIn: ['fade/300', 'fade/250'],
  animationOut: ['fade/250', 'fade/200'],
  slideTransitionIn: ['fade/300', 'fade/250'],
  slideTransitionOut: ['fade/300', 'fade/250'],
}

/** The factory transitions the last migration that ran left on the screens. */
function lastFactory(db: Database): Signatures {
  if (isApplied(db, QUICK_MIGRATION_KEY)) return QUICK
  if (isApplied(db, CALM_MIGRATION_KEY)) return CALM
  return OLD_FACTORY
}

/**
 * Every transition earlier factory designs shipped, as "type/duration": the
 * old fades, the instant cuts (0 ms or none), the livestream slide-in and the
 * calm fades. A missing slide transition is factory too.
 */
const OLD_FACTORY: Signatures = {
  animationIn: ['fade/300', 'fade/0', 'none/0', 'slide-up/200', 'fade/500'],
  animationOut: [
    'fade/200',
    'fade/250',
    'fade/0',
    'none/0',
    'slide-down/150',
    'fade/400',
  ],
  slideTransitionIn: [
    'missing',
    'fade/250',
    'fade/0',
    'none/0',
    'none/250',
    'fade/400',
  ],
  slideTransitionOut: [
    'missing',
    'fade/250',
    'fade/0',
    'none/0',
    'none/250',
    'fade/300',
  ],
}

function signature(transition: Transition): string {
  if (!transition) return 'missing'
  return `${transition.type}/${transition.duration}`
}

function hasFactoryTransitions(
  element: Record<string, unknown>,
  factory: Signatures,
): boolean {
  if (!element.animationIn) return false
  return (Object.keys(factory) as TransitionKey[]).every((key) =>
    factory[key].includes(signature(element[key] as Transition)),
  )
}

/** Gives every element still on factory transitions the current ones; true if any changed. */
function upgradeConfig(
  config: Record<string, unknown>,
  screenType: ScreenType,
  factory: Signatures,
): boolean {
  let changed = false
  for (const element of Object.values(config)) {
    if (!element || typeof element !== 'object') continue
    const fields = element as Record<string, unknown>
    if (!hasFactoryTransitions(fields, factory)) continue
    Object.assign(fields, factoryTransitions(screenType))
    changed = true
  }
  return changed
}

function isApplied(db: Database, key: string): boolean {
  const count = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(key)?.count
  return !!count && count > 0
}

/** Exactly the quick fades of one screen type, in the order of TransitionKey. */
const QUICK_BY_TYPE: [ScreenType, string[]][] = [
  ['primary', ['fade/300', 'fade/250', 'fade/300', 'fade/300']],
  ['livestream', ['fade/250', 'fade/200', 'fade/250', 'fade/250']],
]
const KEYS: TransitionKey[] = [
  'animationIn',
  'animationOut',
  'slideTransitionIn',
  'slideTransitionOut',
]

/**
 * The screen type whose quick factory fades an element of a template still
 * has, exactly; null when someone changed them. A template has no screen
 * type of its own, so its fades say which factory they came from.
 */
function quickFactoryTypeOf(
  element: Record<string, unknown>,
): ScreenType | null {
  const signatures = KEYS.map((key) => signature(element[key] as Transition))
  const match = QUICK_BY_TYPE.find(([, quick]) =>
    quick.every((value, i) => value === signatures[i]),
  )
  return match ? match[0] : null
}

/** Gives a template's elements still on the quick fades the current ones. */
function upgradeTemplateLayouts(layouts: Record<string, unknown>): boolean {
  let changed = false
  for (const config of Object.values(layouts)) {
    if (!config || typeof config !== 'object') continue
    for (const element of Object.values(config as Record<string, unknown>)) {
      if (!element || typeof element !== 'object') continue
      const fields = element as Record<string, unknown>
      const screenType = quickFactoryTypeOf(fields)
      if (!screenType) continue
      Object.assign(fields, factoryTransitions(screenType))
      changed = true
    }
  }
  return changed
}

function tableExists(db: Database, name: string): boolean {
  return !!db
    .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name)
}

/** The screens' own layouts, from before they moved into templates. */
function upgradeScreenLayouts(db: Database, factory: Signatures): number {
  if (!tableExists(db, 'screen_content_configs')) return 0
  const rows = db
    .query<{ id: number; config: string; type: ScreenType }, []>(
      `SELECT c.id, c.config, s.type FROM screen_content_configs c
       JOIN screens s ON s.id = c.screen_id`,
    )
    .all()
  let upgraded = 0
  for (const row of rows) {
    const config = JSON.parse(row.config) as Record<string, unknown>
    if (!upgradeConfig(config, row.type, factory)) continue
    db.run(
      'UPDATE screen_content_configs SET config = ?, updated_at = unixepoch() WHERE id = ?',
      [JSON.stringify(config), row.id],
    )
    upgraded++
  }
  return upgraded
}

/**
 * The church's own templates (bundled ones are rewritten on every start),
 * which took their layouts from the screens while the quick fades were the
 * factory ones.
 */
function upgradeTemplates(db: Database): number {
  if (!tableExists(db, 'slide_templates')) return 0
  const rows = db
    .query<{ id: number; layouts: string }, []>(
      'SELECT id, layouts FROM slide_templates WHERE bundled_key IS NULL',
    )
    .all()
  let upgraded = 0
  for (const row of rows) {
    const layouts = JSON.parse(row.layouts) as Record<string, unknown>
    if (!upgradeTemplateLayouts(layouts)) continue
    db.run(
      'UPDATE slide_templates SET layouts = ?, updated_at = unixepoch() WHERE id = ?',
      [JSON.stringify(layouts), row.id],
    )
    upgraded++
  }
  return upgraded
}

/**
 * Moves text elements from the transitions earlier factory designs shipped to
 * the current factory ones of their screen type
 * (default-design/factoryTransitions.ts): the screens' own layouts while they
 * still exist, and the church's templates once the layouts moved into them.
 * Only the values the last migration left are factory: where the quick (or
 * calm) migration already ran, a cut or a duration someone chose since stays.
 * Transitions someone changed in the screen editor keep their values. Runs
 * once.
 */
export function upgradeFactoryTransitions(db: Database): void {
  if (isApplied(db, MIGRATION_KEY)) {
    log('debug', 'Already applied, skipping')
    return
  }
  const factory = lastFactory(db)

  db.run('BEGIN TRANSACTION')
  try {
    const screens = upgradeScreenLayouts(db, factory)
    const templates = upgradeTemplates(db)
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [
        MIGRATION_KEY,
        JSON.stringify({
          configsUpgraded: screens,
          templatesUpgraded: templates,
        }),
      ],
    )
    db.run('COMMIT')
    log(
      'info',
      `Factory transitions on ${screens} screen layout(s) and ${templates} template(s)`,
    )
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed: ${error}`)
    throw error
  }
}

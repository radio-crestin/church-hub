import type { Database } from 'bun:sqlite'
import { factoryTransitions } from '../../service/presentation/default-design/factoryTransitions'
import type { ScreenType } from '../../service/presentation/types'

const MIGRATION_KEY = 'factory_transitions_v2'
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

/**
 * Moves the screens' text elements from the transitions earlier factory
 * designs shipped to the current factory ones of their screen type
 * (default-design/factoryTransitions.ts). Where the calm migration already
 * ran, only the calm fades are factory: a cut someone chose since stays.
 * Transitions someone changed in the screen editor keep their values. Runs once.
 */
export function upgradeFactoryTransitions(db: Database): void {
  if (isApplied(db, MIGRATION_KEY)) {
    log('debug', 'Already applied, skipping')
    return
  }
  const factory = isApplied(db, CALM_MIGRATION_KEY) ? CALM : OLD_FACTORY

  const rows = db
    .query<{ id: number; config: string; type: ScreenType }, []>(
      `SELECT c.id, c.config, s.type FROM screen_content_configs c
       JOIN screens s ON s.id = c.screen_id`,
    )
    .all()

  let upgraded = 0
  db.run('BEGIN TRANSACTION')
  try {
    for (const row of rows) {
      const config = JSON.parse(row.config) as Record<string, unknown>
      if (!upgradeConfig(config, row.type, factory)) continue
      db.run(
        'UPDATE screen_content_configs SET config = ?, updated_at = unixepoch() WHERE id = ?',
        [JSON.stringify(config), row.id],
      )
      upgraded++
    }
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [MIGRATION_KEY, JSON.stringify({ configsUpgraded: upgraded })],
    )
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed: ${error}`)
    throw error
  }
  log('info', `Factory transitions on ${upgraded} screen content config(s)`)
}
